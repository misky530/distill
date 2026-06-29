"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
}

/**
 * 用唯一id避免同一页面内多个mermaid实例（winner/loser对比时会同时存在两个）
 * 渲染冲突——mermaid.render内部会用id去操作DOM，重复id会导致互相覆盖。
 */
let renderCounter = 0;

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [idSuffix] = useState(() => `mermaid-${++renderCounter}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;
      setError(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        const { svg } = await mermaid.render(idSuffix, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("[MermaidDiagram] render failed", err);
        if (!cancelled) {
          setError("思维导图渲染失败，请检查生成内容格式");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, idSuffix]);

  if (error) {
    return (
      <div className="mindmap-error">
        <p>{error}</p>
        <pre className="mindmap-code">{code}</pre>
      </div>
    );
  }

  return <div ref={containerRef} className="mindmap-rendered" />;
}
