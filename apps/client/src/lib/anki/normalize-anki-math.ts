/**
 * Convert Anki legacy / MathJax wrappers to `\(...\)` / `\[...\]`
 * so display-time KaTeX can render them. Already-canonical delimiters
 * (`\(`, `\[`, `$`, `$$`) are left unchanged.
 */
export function normalizeAnkiMath(html: string): string {
  let out = html

  // [latex]...[/latex] → \[...\]
  out = out.replace(
    /\[latex\]([\s\S]*?)\[\/latex\]/gi,
    (_, body: string) => `\\[${body.trim()}\\]`
  )

  // [$$]...[/$$] → \[...\]
  out = out.replace(
    /\[\$\$\]([\s\S]*?)\[\/\$\$\]/gi,
    (_, body: string) => `\\[${body.trim()}\\]`
  )

  // [$]...[/$] → \(...\)
  out = out.replace(
    /\[\$\]([\s\S]*?)\[\/\$\]/gi,
    (_, body: string) => `\\(${body.trim()}\\)`
  )

  // <anki-mathjax block="true">...</anki-mathjax> → \[...\]
  out = out.replace(
    /<anki-mathjax\b([^>]*)>([\s\S]*?)<\/anki-mathjax>/gi,
    (_match, attrs: string, body: string) => {
      const isBlock = /\bblock\s*=\s*(["']?)true\1/i.test(attrs)
      const trimmed = body.trim()
      return isBlock ? `\\[${trimmed}\\]` : `\\(${trimmed}\\)`
    }
  )

  return out
}
