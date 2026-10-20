'use client';

import { useEffect, useRef } from 'react';

interface GlbViewerProps {
  url: string;
  alt: string;
  className?: string;
}

/**
 * 3D 模型預覽：動態載入 @google/model-viewer（three.js web component），
 * 僅在客戶端掛載，避免 SSR 問題。
 */
export function GlbViewer({ url, alt, className }: GlbViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    import('@google/model-viewer')
      .then(() => {
        if (disposed || !containerRef.current) return;
        const el = document.createElement('model-viewer');
        el.setAttribute('src', url);
        el.setAttribute('alt', alt);
        el.setAttribute('camera-controls', '');
        el.setAttribute('auto-rotate', '');
        el.setAttribute('shadow-intensity', '1');
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        el.style.borderRadius = '0.5rem';
        containerRef.current.appendChild(el);
      })
      .catch(() => {
        /* 模型載入器載入失敗時維持容器（使用者仍可下載檔案） */
      });

    return () => {
      disposed = true;
      container.replaceChildren();
    };
  }, [url, alt]);

  return <div ref={containerRef} className={className} />;
}
