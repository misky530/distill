import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Distill — 视频转知识',
  description: '粘贴转录文本，生成摘要、结构化笔记和思维导图',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
