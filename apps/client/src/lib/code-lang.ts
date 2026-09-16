export type CodeLang = 'js' | 'ts' | 'py' | 'sql' | 'sh' | 'code'

const ALIAS: Record<string, Exclude<CodeLang, 'code'>> = {
  py: 'py',
  python: 'py',
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  sql: 'sql',
  sh: 'sh',
  bash: 'sh',
  shell: 'sh'
}

/** Map HTML/class lang tokens to a known CodeLang; unknown → `'code'`. */
export function toCodeLang(raw: string | undefined): CodeLang {
  if (!raw?.trim()) return 'code'
  for (const token of raw.toLowerCase().split(/\s+/)) {
    const key = token.replace(/^(?:language-|lang-)/, '')
    const mapped = ALIAS[key]
    if (mapped) return mapped
  }
  return 'code'
}

// ponytail: keyword scores, highlight.js if guesses fail in the wild
const DETECT: { lang: Exclude<CodeLang, 'code'>; patterns: RegExp[] }[] = [
  { lang: 'py', patterns: [/\bdef\s+\w+/, /\belif\b/, /\bself\./, /\bprint\s*\(/] },
  { lang: 'sql', patterns: [/\bSELECT\b/i, /\bFROM\b/i, /\bWHERE\b/i] },
  { lang: 'sh', patterns: [/^#!/, /\becho\b/, /\$\w+/] },
  {
    lang: 'ts',
    patterns: [/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /:\s*(?:string|number|boolean)\b/]
  },
  {
    lang: 'js',
    patterns: [/\bfunction\s+\w+/, /\bconst\s+\w+\s*=/, /\blet\s+\w+/, /=>/]
  }
]

const DETECT_THRESHOLD = 1

/** Guess lang from snippet content; unconfident → `'code'`. */
export function detectCodeLang(code: string): CodeLang {
  if (!code.trim()) return 'code'

  const scored = DETECT.map(({ lang, patterns }) => ({
    lang,
    score: patterns.reduce((n, re) => n + (re.test(code) ? 1 : 0), 0)
  }))
    .filter(s => s.score >= DETECT_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return 'code'
  if (scored.length > 1 && scored[0].score === scored[1].score) return 'code'
  return scored[0].lang
}

/** Prefer a known class alias; otherwise guess from code. */
export function resolveCodeLang(
  classAttr: string | undefined,
  code: string
): CodeLang {
  if (classAttr?.trim()) {
    const fromClass = toCodeLang(classAttr)
    if (fromClass !== 'code') return fromClass
  }
  return detectCodeLang(code)
}

export async function getLanguageExtension(lang: CodeLang) {
  switch (lang) {
    case 'ts': {
      const mod = await import('@codemirror/lang-javascript')
      return mod.javascript({ typescript: true })
    }

    case 'js': {
      const mod = await import('@codemirror/lang-javascript')
      return mod.javascript()
    }

    case 'py': {
      const mod = await import('@codemirror/lang-python')
      return mod.python()
    }

    case 'sql': {
      const mod = await import('@codemirror/lang-sql')
      return mod.sql()
    }

    default:
      return []
  }
}
