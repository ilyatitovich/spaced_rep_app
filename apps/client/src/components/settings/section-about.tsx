import { BackButton, Header, Screen } from '@/components'
import { ABOUT_FOOTER, ABOUT_SECTIONS } from '@/lib/about-content'
import { SettingsGroup } from './settings-ui'

type SectionAboutProps = {
  isOpen: boolean
}

export default function SectionAbout({ isOpen }: SectionAboutProps) {
  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">About</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {ABOUT_SECTIONS.map(section => (
          <SettingsGroup key={section.title} label={section.title}>
            <p className="px-4 py-3.5 text-sm text-foreground-muted leading-relaxed">
              {section.body}
            </p>
          </SettingsGroup>
        ))}

        <p className="px-1 text-xs text-foreground-muted text-center">
          {ABOUT_FOOTER}
        </p>
      </div>
    </Screen>
  )
}
