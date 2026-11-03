import { ChevronDown } from 'lucide-react'

import type { CodeLang } from '@/lib'

export default function LangSelect({
  lang,
  onChange
}: {
  lang: CodeLang
  onChange: (lang: CodeLang) => void
}) {
  return (
    <div className="relative w-fit">
      <select
        value={lang}
        onChange={e => onChange(e.target.value as CodeLang)}
        className="
          text-sm border border-border rounded-md
          bg-card px-3 py-1 pr-8
          outline-none
          appearance-none
          focus:ring-1 focus:ring-focus-ring
        "
      >
        <option value="ts">TypeScript</option>
        <option value="py">Python</option>
        <option value="sql">SQL</option>
        <option value="sh">Bash</option>
      </select>

      <ChevronDown
        size={16}
        className="
          pointer-events-none
          absolute right-2 top-1/2 -translate-y-1/2
          text-foreground
        "
      />
    </div>
  )
}
