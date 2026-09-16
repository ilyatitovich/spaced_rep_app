import { Copy, Download, ExternalLink, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

import { BackButton, Header, Screen } from '@/components'
import { SettingsActionRow, SettingsGroup } from './settings-ui'

const SKILL_URL = '/llm/SKILL.md'
const PROMPT_URL = '/llm/prompt.md'

type SectionCreateWithAiProps = {
  isOpen: boolean
}

async function copyFromUrl(url: string, label: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const text = await res.text()
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Couldn’t copy ${label.toLowerCase()}`)
  }
}

export default function SectionCreateWithAi({
  isOpen
}: SectionCreateWithAiProps) {
  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Create with AI</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        <SettingsGroup label="How it works">
          <p className="px-4 py-3.5 text-sm text-foreground-muted leading-relaxed">
            Copy the prompt or skill into ChatGPT, Claude, Cursor, or another
            LLM, then send your topic and notes in the same message (for
            example: “Topic: React hooks” plus your notes). Paste the JSON it
            returns, or save a file, then open a topic → Settings → Import
            cards.
          </p>
        </SettingsGroup>

        <SettingsGroup
          label="Prompt"
          footer="Short paste-in instructions for any chat LLM."
        >
          <SettingsActionRow
            icon={<Copy size={18} />}
            label="Copy prompt"
            onClick={() => void copyFromUrl(PROMPT_URL, 'Prompt')}
          />
          <a
            href={PROMPT_URL}
            download="spaced-rep-card-prompt.md"
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-primary"
          >
            <Download size={18} />
            Download prompt
          </a>
        </SettingsGroup>

        <SettingsGroup
          label="Skill"
          footer="Full SKILL.md for Cursor and other agents that load skills."
        >
          <SettingsActionRow
            icon={<Copy size={18} />}
            label="Copy skill"
            onClick={() => void copyFromUrl(SKILL_URL, 'Skill')}
          />
          <SettingsActionRow
            icon={<ExternalLink size={18} />}
            label="Open skill"
            onClick={() => window.open(SKILL_URL, '_blank', 'noopener,noreferrer')}
          />
          <a
            href={SKILL_URL}
            download="create-cards-SKILL.md"
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 font-medium text-primary"
          >
            <Download size={18} />
            Download skill
          </a>
        </SettingsGroup>

        <p className="px-1 text-xs text-foreground-muted text-center flex items-center justify-center gap-1.5">
          <Sparkles size={12} aria-hidden />
          Imported cards start as Draft until you promote them.
        </p>
      </div>
    </Screen>
  )
}
