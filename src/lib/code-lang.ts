export type CodeLang = 'js' | 'ts' | 'py' | 'sql' | 'sh'

export async function getLanguageExtension(lang: CodeLang) {
  switch (lang) {
    case 'ts': {
      const mod = await import('@codemirror/lang-javascript')
      return mod.javascript({ typescript: lang === 'ts' })
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
