import { readFile } from "fs/promises";
import https from "https";

const SF_API_KEY = "sk-uvayubqyomoymprkffllrvwwhbpzpgjsjbqcmxgzzihxnvxu";
const filePath = "C:/Users/Administrator/Music/real_test.mp3";
const SF_MODEL = "FunAudioLLM/SenseVoiceSmall";

const audioBuffer = await readFile(filePath);
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

console.log("body length:", body.length);

const options = {
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
  console.log("status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => console.log("body:", data));
});

req.on("error", (err) => console.error("request error:", err));
req.write(body);
req.end();
