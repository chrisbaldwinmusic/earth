'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function buildSnippet(origin: string) {
  return `<iframe\n  src="${origin}/embed"\n  style="width:100%; height:600px; border:0;"\n  loading="lazy"\n></iframe>`
}

interface Props {
  className?: string
}

export default function EmbedButton({ className }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const snippet = buildSnippet(origin)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable — the textarea below still lets the user select + copy manually.
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          'shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors'
        }
      >
        Embed
      </button>

      {open &&
        createPortal(
          <div
            ref={overlayRef}
            onMouseDown={(e) => { if (e.target === overlayRef.current) setOpen(false) }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white text-sm font-semibold">Embed this map</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:text-white text-sm transition-colors"
                >
                  Close
                </button>
              </div>

              <p className="text-zinc-400 text-xs mb-3 leading-relaxed">
                Paste this into any site to show a read-only version of the map.
              </p>

              <textarea
                readOnly
                value={snippet}
                onFocus={(e) => e.currentTarget.select()}
                rows={5}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-md px-3 py-2 mb-3 focus:outline-none focus:border-zinc-500 resize-none"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-700/80 border border-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy snippet'}
                </button>
                <a
                  href="/embed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-white text-xs transition-colors"
                >
                  Preview →
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
