import { useLayoutEffect, useRef } from 'react'

import { renderCardMath } from '@/lib/render-math'
import { sanitizeCardHtml } from '@/lib/sanitize-html'

interface CardRichTextProps {
  html: string
  className?: string
}

/** Sanitize card HTML then typeset LaTeX delimiters with KaTeX. */
export default function CardRichText({ html, className }: CardRichTextProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = sanitizeCardHtml(html || '<p></p>')
    renderCardMath(el)
  }, [html])

  return <div ref={ref} className={className} />
}
