import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdtemp, rm, readFile, stat, copyFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import https from "https";

const YT_DLP = process.env.YT_DLP_PATH ?? "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH ?? "";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe"; // 新增这一行
const COOKIES_SOURCE = process.env.BILIBILI_COOKIES_PATH ?? "";
const SF_API_KEY = process.env.SILICONFLOW_API_KEY ?? "";
const SF_MODEL = "FunAudioLLM/SenseVoiceSmall";

const MIN_DURATION_SECONDS = 10;

function downloadAudio(
  url: string,
  outputPath: string,
  attempt: number,
  cookiesPath: string | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--output",
      outputPath,
      "--no-playlist",
      "--proxy",
      "", // 绕过本地代理，避免CDN截断
      "--force-overwrites", // 防止复用上次失败的缓存文件
      "--no-continue", // 不续传，每次重新完整下载
    ];

    // 重试时尝试不同策略：第1次用纯音频流，第2次起强制走"视频+音频再提取"路径
    // 纯音频流(30280)通常在4-5MB，限制50MB足够；但降级路径要先下整段视频再提取音频，
    // 视频本身可能远超50MB（取决于清晰度/时长），所以降级路径不施加文件大小限制，
    // 否则会在真正尝试下载之前就被Aborting，导致重试形同虚设。
    if (attempt === 1) {
      args.push("-f", "30280/ba", "--max-filesize", "50m");
    } else {
      args.push("-f", "bv*+ba/b"); // 不限制大小，ASR本身会在转录阶段做时长/大小把关
    }

    // 用本次请求的可写副本，不直接用挂载进容器的只读源文件——
    // yt-dlp在退出时会尝试把session状态写回cookie文件，只读挂载会导致这一步报ENOSPC/EROFS。
    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    }

    if (FFMPEG) {
      args.push("--ffmpeg-location", FFMPEG);
    }

    const proc = spawn(YT_DLP, args);
    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.stdout.on("data", (d: Buffer) => {
      console.log("[yt-dlp]", d.toString());
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code}: ${stderr}`));
    });

    proc.on("error", reject);
  });
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobePath = FFPROBE;
    const args = [
      "-i",
      filePath,
      "-show_entries",
      "format=duration",
      "-v",
      "quiet",
      "-of",
      "csv=p=0",
    ];
    const proc = spawn(ffprobePath, args);
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on("close", () => {
      const duration = parseFloat(stdout.trim());
      resolve(isNaN(duration) ? 0 : duration);
    });
    proc.on("error", reject);
  });
}

async function downloadWithRetry(
  url: string,
  outputPath: string,
  cookiesPath: string | null,
  maxAttempts = 3,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[transcribe] download attempt ${attempt}/${maxAttempts}`);
    try {
      await downloadAudio(url, outputPath, attempt, cookiesPath);
      const duration = await getAudioDuration(outputPath);
      console.log(`[transcribe] downloaded duration: ${duration}s`);

      if (duration >= MIN_DURATION_SECONDS) {
        return;
      }

      console.warn(
        `[transcribe] suspiciously short (${duration}s), retrying...`,
      );
      lastError = new Error(
        `下载异常：音频时长仅 ${duration.toFixed(1)} 秒，可能是CDN节点问题或文件超出大小限制`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[transcribe] attempt ${attempt} failed:`,
        lastError.message,
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw lastError ?? new Error("下载失败，已达最大重试次数");
}

function postToSiliconFlow(body: Buffer, boundary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: "api.siliconflow.cn",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${SF_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          try {
            resolve(JSON.parse(data).text as string);
          } catch {
            reject(new Error(`SiliconFlow返回了非JSON响应: ${data}`));
          }
        } else {
          reject(
            new Error(
              `SiliconFlow ASR error ${status}${data ? `: ${data}` : "（空响应体）"}`,
            ),
          );
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function transcribeAudio(filePath: string): Promise<string> {
  const audioBuffer = await readFile(filePath);
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const boundary = `----distill${Date.now().toString(16)}`;
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `${SF_MODEL}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n` +
        `Content-Type: audio/mpeg\r\n\r\n`,
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, audioBuffer, epilogue]);

    try {
      return await postToSiliconFlow(body, boundary);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[transcribe] ASR attempt ${attempt}/${maxAttempts} failed:`,
        lastError.message,
      );

      const statusMatch = lastError.message.match(/error (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
      if (![500, 502, 503, 504].includes(status)) {
        throw lastError;
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  throw lastError ?? new Error("ASR转录失败，已达最大重试次数");
}

export async function POST(req: NextRequest) {
  if (!SF_API_KEY) {
    return NextResponse.json(
      { error: "SILICONFLOW_API_KEY not configured" },
      { status: 500 },
    );
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const isValid =
    url.includes("bilibili.com") ||
    url.includes("b23.tv") ||
    url.includes("douyin.com");
  if (!isValid) {
    return NextResponse.json({ error: "仅支持B站或抖音链接" }, { status: 400 });
  }

  let tmpDir: string | null = null;

  try {
    tmpDir = await mkdtemp(join(tmpdir(), "distill-"));
    const audioPath = join(tmpDir, "audio.mp3");

    // cookie源文件通过只读volume挂载进容器（防止意外写入），但yt-dlp退出时
    // 会尝试把session状态写回cookie文件本身。这里每次请求都复制一份到当次
    // 请求的可写临时目录，yt-dlp操作的是副本，原始挂载文件始终保持不变。
    let cookiesPath: string | null = null;
    if (COOKIES_SOURCE) {
      cookiesPath = join(tmpDir, "cookies.txt");
      await copyFile(COOKIES_SOURCE, cookiesPath);
    }

    console.log("[transcribe] downloading:", url);
    await downloadWithRetry(url, audioPath, cookiesPath);

    const fileSize = (await stat(audioPath)).size;
    console.log("[transcribe] final file size:", fileSize, "bytes");

    // 转录前的硬上限：硅基流动ASR限制文件不超过50MB、时长不超过1小时
    if (fileSize > 50 * 1024 * 1024) {
      throw new Error(
        "提取出的音频超过50MB，硅基流动ASR无法处理，请尝试更短的视频",
      );
    }

    console.log("[transcribe] transcribing...");
    const transcript = await transcribeAudio(audioPath);

    console.log("[transcribe] done, length:", transcript.length);
    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[transcribe]", err);
    const message = err instanceof Error ? err.message : "transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
