'use client'

import { useState } from 'react'

interface GenerateContent {
  summary: string
  document: string
  mindmap: string
}

interface GenerateResponse {
  content: GenerateContent
  winner?: string
  scores?: Record<string, {
    coverage: number
    structure: number
    factuality: number
    total: number
    reasoning: string
  }>
}

type Tab = 'summary' | 'document' | 'mindmap'
type Plan = 'free' | 'pro'
type Status = 'idle' | 'loading' | 'done' | 'error'

export default function Home() {
  const [transcript, setTranscript] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!transcript.trim()) return
    setStatus('loading')
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setStatus('done')
      setActiveTab('summary')
    } catch {
      setStatus('error')
    }
  }

  function handleCopy() {
    if (!result) return
    const tab = activeTab
    const text = tab === 'summary'
      ? result.content.summary
      : tab === 'document'
      ? result.content.document
      : result.content.mindmap
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const winnerScore = result?.scores && result.winner
    ? result.scores[result.winner]?.total
    : null

  return (
    <div className="app">
      <header className="header">
        <div className="logo">dist<span>i</span>ll</div>
        <div className="tagline">视频转录 → 结构化知识</div>
      </header>

      <main className="main">
        {/* Input */}
        <section className="input-section">
          <label className="input-label" htmlFor="transcript">转录文本</label>
          <div className="textarea-wrap">
            <textarea
              id="transcript"
              placeholder="粘贴视频转录文本，或直接输入内容……"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              disabled={status === 'loading'}
            />
          </div>
          <div className="controls">
            <div className="plan-toggle">
              <button
                className={`plan-btn${plan === 'free' ? ' active' : ''}`}
                onClick={() => setPlan('free')}
              >
                free
              </button>
              <button
                className={`plan-btn${plan === 'pro' ? ' active' : ''}`}
                onClick={() => setPlan('pro')}
              >
                pro ✦
              </button>
            </div>
            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={status === 'loading' || !transcript.trim()}
            >
              {status === 'loading' ? '生成中…' : '生成知识'}
            </button>
            <span className="char-count">{transcript.length} 字</span>
          </div>
        </section>

        {/* Status */}
        {status === 'loading' && (
          <div className="status-bar">
            <div className="status-dot" />
            {plan === 'pro'
              ? 'DeepSeek + Kimi 并行生成，Doubao 裁判评分中…'
              : 'DeepSeek 生成中…'}
          </div>
        )}

        {status === 'error' && (
          <div className="status-bar error">
            <div className="status-dot" />
            生成失败，请检查 API 配置或稍后重试
          </div>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <div className="results">
            {result.winner && (
              <div className="judge-banner">
                ✦ Doubao 裁判：{result.winner} 胜出
                {winnerScore !== null && (
                  <span style={{ opacity: 0.7 }}>（综合评分 {winnerScore.toFixed(1)} / 10）</span>
                )}
              </div>
            )}

            <div className="tabs">
              {(['summary', 'document', 'mindmap'] as Tab[]).map(t => (
                <button
                  key={t}
                  className={`tab${activeTab === t ? ' active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t === 'summary' ? '摘要' : t === 'document' ? '学习笔记' : '思维导图'}
                </button>
              ))}
            </div>

            <div className="tab-content">
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? '已复制 ✓' : '复制'}
              </button>

              {activeTab === 'summary' && (
                <div className="summary-text">{result.content.summary}</div>
              )}

              {activeTab === 'document' && (
                <div className="document-content">{result.content.document}</div>
              )}

              {activeTab === 'mindmap' && (
                <div className="mindmap-content">
                  <pre className="mindmap-code">{result.content.mindmap}</pre>
                </div>
              )}
            </div>

            {/* Judge scores */}
            {result.scores && Object.keys(result.scores).length > 0 && (
              <div className="scores">
                <div className="scores-title">评分详情</div>
                {Object.entries(result.scores)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([provider, score], i) => (
                    <div key={provider} className="score-row">
                      <span className="score-provider">{provider}</span>
                      <div className="score-bar-wrap">
                        <div
                          className={`score-bar${i > 0 ? ' loser' : ''}`}
                          style={{ width: `${score.total * 10}%` }}
                        />
                      </div>
                      <span className="score-num">{score.total.toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {status === 'idle' && (
          <div className="empty-state">
            <div>粘贴转录文本，一键生成结构化知识</div>
            <div className="hint">free · 单模型 / pro · 双模型 + AI 裁判</div>
          </div>
        )}
      </main>
    </div>
  )
}
