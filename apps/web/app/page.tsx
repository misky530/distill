"use client";

import { useState } from "react";
import MermaidDiagram from "../components/MermaidDiagram";

interface GenerateContent {
  summary: string;
  document: string;
  mindmap: string;
}

interface GenerateResponse {
  content: GenerateContent;
  winner?: string;
  loser?: string;
  loserContent?: GenerateContent;
  scores?: Record<
    string,
    {
      coverage: number;
      structure: number;
      factuality: number;
      total: number;
      reasoning: string;
    }
  >;
}

type Tab = "summary" | "document" | "mindmap";
type Plan = "free" | "pro";
type InputMode = "text" | "url";
type Status = "idle" | "transcribing" | "generating" | "done" | "error";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [transcript, setTranscript] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [plan, setPlan] = useState<Plan>("free");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState(false);
  const [showLoser, setShowLoser] = useState(false);
  const [loserTab, setLoserTab] = useState<Tab>("summary");

  async function handleGenerate() {
    setResult(null);
    setErrorMsg("");
    setShowLoser(false);

    let finalTranscript = transcript;

    // 如果是URL模式，先转录
    if (inputMode === "url") {
      if (!videoUrl.trim()) return;
      setStatus("transcribing");
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: videoUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "转录失败");
        finalTranscript = data.transcript;
        setTranscript(data.transcript); // 同步填入文本框，方便用户查看/编辑
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "转录失败");
        setStatus("error");
        return;
      }
    }

    if (!finalTranscript.trim()) {
      setErrorMsg("转录文本为空");
      setStatus("error");
      return;
    }

    setStatus("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: finalTranscript, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setResult(data);
      setStatus("done");
      setActiveTab("summary");
      setLoserTab("summary");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "生成失败");
      setStatus("error");
    }
  }

  function handleCopy() {
    if (!result) return;
    const tab = activeTab;
    const text =
      tab === "summary"
        ? result.content.summary
        : tab === "document"
          ? result.content.document
          : result.content.mindmap;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isBusy = status === "transcribing" || status === "generating";
  const canSubmit =
    inputMode === "text"
      ? transcript.trim().length > 0
      : videoUrl.trim().length > 0;

  const winnerScore =
    result?.scores && result.winner
      ? result.scores[result.winner]?.total
      : null;

  const loserScore =
    result?.scores && result.loser ? result.scores[result.loser]?.total : null;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          dist<span>i</span>ll
        </div>
        <div className="tagline">视频转录 → 结构化知识</div>
      </header>

      <main className="main">
        {/* Input mode switch */}
        <section className="input-section">
          <div className="mode-tabs">
            <button
              className={`mode-tab${inputMode === "text" ? " active" : ""}`}
              onClick={() => setInputMode("text")}
              disabled={isBusy}
            >
              文本输入
            </button>
            <button
              className={`mode-tab${inputMode === "url" ? " active" : ""}`}
              onClick={() => setInputMode("url")}
              disabled={isBusy}
            >
              B站/抖音链接
            </button>
          </div>

          {inputMode === "text" ? (
            <>
              <label className="input-label" htmlFor="transcript">
                转录文本
              </label>
              <div className="textarea-wrap">
                <textarea
                  id="transcript"
                  placeholder="粘贴视频转录文本，或直接输入内容……"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </>
          ) : (
            <>
              <label className="input-label" htmlFor="videoUrl">
                视频链接
              </label>
              <input
                id="videoUrl"
                className="url-input"
                type="text"
                placeholder="粘贴B站或抖音视频链接……"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isBusy}
              />
              {transcript && (
                <div className="transcript-preview">
                  <label className="input-label">
                    转录结果（可编辑后重新生成）
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    disabled={isBusy}
                  />
                </div>
              )}
            </>
          )}

          <div className="controls">
            <div className="plan-toggle">
              <button
                className={`plan-btn${plan === "free" ? " active" : ""}`}
                onClick={() => setPlan("free")}
                disabled={isBusy}
              >
                free
              </button>
              <button
                className={`plan-btn${plan === "pro" ? " active" : ""}`}
                onClick={() => setPlan("pro")}
                disabled={isBusy}
              >
                pro ✦
              </button>
            </div>
            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={isBusy || !canSubmit}
            >
              {status === "transcribing"
                ? "转录中…"
                : status === "generating"
                  ? "生成中…"
                  : "生成知识"}
            </button>
            {inputMode === "text" && (
              <span className="char-count">{transcript.length} 字</span>
            )}
          </div>
        </section>

        {/* Status */}
        {status === "transcribing" && (
          <div className="status-bar">
            <div className="status-dot" />
            正在下载并转录视频，可能需要十几秒…
          </div>
        )}

        {status === "generating" && (
          <div className="status-bar">
            <div className="status-dot" />
            {plan === "pro"
              ? "DeepSeek + Kimi 并行生成，Doubao 裁判评分中…"
              : "DeepSeek 生成中…"}
          </div>
        )}

        {status === "error" && (
          <div className="status-bar error">
            <div className="status-dot" />
            {errorMsg || "处理失败，请稍后重试"}
          </div>
        )}

        {/* Results */}
        {status === "done" && result && (
          <div className="results">
            {result.winner && (
              <div className="judge-banner">
                ✦ Doubao 裁判：{result.winner} 胜出
                {winnerScore !== null && (
                  <span style={{ opacity: 0.7 }}>
                    （综合评分 {winnerScore.toFixed(1)} / 10）
                  </span>
                )}
              </div>
            )}

            <div className="tabs">
              {(["summary", "document", "mindmap"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className={`tab${activeTab === t ? " active" : ""}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t === "summary"
                    ? "摘要"
                    : t === "document"
                      ? "学习笔记"
                      : "思维导图"}
                </button>
              ))}
            </div>

            <div className="tab-content">
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? "已复制 ✓" : "复制"}
              </button>

              {activeTab === "summary" && (
                <div className="summary-text">{result.content.summary}</div>
              )}

              {activeTab === "document" && (
                <div className="document-content">
                  {result.content.document}
                </div>
              )}

              {activeTab === "mindmap" && (
                <div className="mindmap-content">
                  <MermaidDiagram code={result.content.mindmap} />
                </div>
              )}
            </div>

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
                          className={`score-bar${i > 0 ? " loser" : ""}`}
                          style={{ width: `${score.total * 10}%` }}
                        />
                      </div>
                      <span className="score-num">
                        {score.total.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {result.loser && result.loserContent && (
              <div className="loser-panel">
                <button
                  className="loser-toggle"
                  onClick={() => setShowLoser((v) => !v)}
                  aria-expanded={showLoser}
                >
                  <span>
                    查看 {result.loser} 的输出
                    {loserScore !== null && (
                      <span style={{ opacity: 0.6 }}>
                        {" "}
                        （综合评分 {loserScore.toFixed(1)} / 10）
                      </span>
                    )}
                  </span>
                  <span className={`loser-chevron${showLoser ? " open" : ""}`}>
                    ▾
                  </span>
                </button>

                {showLoser && (
                  <div className="loser-body">
                    <div className="tabs">
                      {(["summary", "document", "mindmap"] as Tab[]).map(
                        (t) => (
                          <button
                            key={t}
                            className={`tab${loserTab === t ? " active" : ""}`}
                            onClick={() => setLoserTab(t)}
                          >
                            {t === "summary"
                              ? "摘要"
                              : t === "document"
                                ? "学习笔记"
                                : "思维导图"}
                          </button>
                        ),
                      )}
                    </div>

                    <div className="tab-content">
                      {loserTab === "summary" && (
                        <div className="summary-text">
                          {result.loserContent.summary}
                        </div>
                      )}
                      {loserTab === "document" && (
                        <div className="document-content">
                          {result.loserContent.document}
                        </div>
                      )}
                      {loserTab === "mindmap" && (
                        <div className="mindmap-content">
                          <MermaidDiagram code={result.loserContent.mindmap} />
                        </div>
                      )}
                    </div>

                    {result.scores?.[result.loser]?.reasoning && (
                      <div className="loser-reasoning">
                        <span className="loser-reasoning-label">
                          裁判评语：
                        </span>
                        {result.scores[result.loser].reasoning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {status === "idle" && (
          <div className="empty-state">
            <div>粘贴转录文本或视频链接，一键生成结构化知识</div>
            <div className="hint">free · 单模型 / pro · 双模型 + AI 裁判</div>
          </div>
        )}
      </main>
    </div>
  );
}
