import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { mkdtemp, rm, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const YT_DLP = process.env.YT_DLP_PATH ?? 'yt-dlp'
const FFMPEG = process.env.FFMPEG_PATH ?? ''
const COOKIES = process.env.BILIBILI_COOKIES_PATH ?? ''
const SF_API_KEY = process.env.SILICONFLOW_API_KEY ?? ''
const SF_MODEL = 'FunAudioLLM/SenseVoiceSmall'

// 经验值：96kbps音频，每秒约12KB。如果文件时长对应的码率明显偏低，说明下载被截断
const MIN_DURATION_SECONDS = 10

function downloadAudio(url: string, outputPath: string, attempt: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', outputPath,
      '--no-playlist',
      '--max-filesize', '50m',
      '--proxy', '', // 绕过本地代理，避免CDN截断
      '--force-overwrites', // 防止复用上次失败的缓存文件
      '--no-continue', // 不续传，每次重新完整下载
      '--no-cache-dir', // 不使用yt-dlp自身缓存
    ]

    // 重试时尝试不同策略：第1次用纯音频流，第2次起强制走"视频+音频再提取"路径
    // (经验上后者在B站CDN异常时更稳定，因为走的是不同的下载逻辑/连接池)
    if (attempt === 1) {
      args.push('-f', '30280/ba')
    } else {
      args.push('-f', 'bv*+ba/b')
    }

    if (COOKIES) {
      args.push('--cookies', COOKIES)
    }

    if (FFMPEG) {
      args.push('--ffmpeg-location', FFMPEG)
    }

    const proc = spawn(YT_DLP, args)
    let stderr = ''

    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.stdout.on('data', (d: Buffer) => { console.log('[yt-dlp]', d.toString()) })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`yt-dlp exited ${code}: ${stderr}`))
    })

    proc.on('error', reject)
  })
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobePath = FFMPEG ? join(FFMPEG, 'ffprobe') : 'ffprobe'
    const args = [
      '-i', filePath,
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'csv=p=0',
    ]
    const proc = spawn(ffprobePath, args)
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('close', () => {
      const duration = parseFloat(stdout.trim())
      resolve(isNaN(duration) ? 0 : duration)
    })
    proc.on('error', reject)
  })
}

async function downloadWithRetry(url: string, outputPath: string, maxAttempts = 3): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[transcribe] download attempt ${attempt}/${maxAttempts}`)
    try {
      await downloadAudio(url, outputPath, attempt)
      const duration = await getAudioDuration(outputPath)
      console.log(`[transcribe] downloaded duration: ${duration}s`)

      if (duration >= MIN_DURATION_SECONDS) {
        return // 下载成功且时长正常
      }

      console.warn(`[transcribe] suspiciously short (${duration}s), retrying...`)
      lastError = new Error(`下载异常：音频时长仅 ${duration.toFixed(1)} 秒，可能是CDN节点问题`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[transcribe] attempt ${attempt} failed:`, lastError.message)
    }

    // 重试前等待一下，给CDN负载均衡一个切换节点的机会
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  throw lastError ?? new Error('下载失败，已达最大重试次数')
}

async function transcribeAudio(filePath: string): Promise<string> {
  const audioBuffer = await readFile(filePath)
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })

  const form = new FormData()
  form.append('file', blob, 'audio.mp3')
  form.append('model', SF_MODEL)

  const res = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SF_API_KEY}`,
    },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SiliconFlow ASR error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.text as string
}

export async function POST(req: NextRequest) {
  if (!SF_API_KEY) {
    return NextResponse.json({ error: 'SILICONFLOW_API_KEY not configured' }, { status: 500 })
  }

  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const isValid = url.includes('bilibili.com') || url.includes('b23.tv') || url.includes('douyin.com')
  if (!isValid) {
    return NextResponse.json({ error: '仅支持B站或抖音链接' }, { status: 400 })
  }

  let tmpDir: string | null = null

  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'distill-'))
    const audioPath = join(tmpDir, 'audio.mp3')

    console.log('[transcribe] downloading:', url)
    await downloadWithRetry(url, audioPath)

    const fileSize = (await stat(audioPath)).size
    console.log('[transcribe] final file size:', fileSize, 'bytes')

    console.log('[transcribe] transcribing...')
    const transcript = await transcribeAudio(audioPath)

    console.log('[transcribe] done, length:', transcript.length)
    return NextResponse.json({ transcript })

  } catch (err) {
    console.error('[transcribe]', err)
    const message = err instanceof Error ? err.message : 'transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
