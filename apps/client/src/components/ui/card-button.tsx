import { useEffect, useRef, useState } from 'react'
import {
  RefreshCw,
  Images,
  Type,
  Volume2,
  ImagePlus,
  CodeXml
} from 'lucide-react'
import type { ElementType } from 'react'

import type { CodeLang } from '@/lib'
import TsLogo from '@/assets/lang-logos/ts-14px.svg?react'
import PythonLogo from '@/assets/lang-logos/python-14px.svg?react'
import SqlLogo from '@/assets/lang-logos/sql-14px.svg?react'
import BashLogo from '@/assets/lang-logos/bash-14px.svg?react'

type MediaKind = 'image' | 'audio'

type CardButtonProps = {
  isDisabled?: boolean
} & (
  | { type: 'flip' | 'text'; onClick: () => void }
  | { type: 'code'; onSelectCode: (lang: CodeLang) => void }
  | { type: 'media'; onSelectMedia: (kind: MediaKind) => void }
)

const CODE_LANG_OPTIONS: {
  lang: CodeLang
  label: string
  icon: ElementType
}[] = [
  { lang: 'ts', label: 'TypeScript', icon: TsLogo },
  { lang: 'py', label: 'Python', icon: PythonLogo },
  { lang: 'sql', label: 'SQL', icon: SqlLogo },
  { lang: 'sh', label: 'Bash', icon: BashLogo }
]

const META: Record<
  CardButtonProps['type'],
  { Icon: ElementType; label: string }
> = {
  flip: { Icon: RefreshCw, label: 'Flip' },
  text: { Icon: Type, label: 'Text' },
  code: { Icon: CodeXml, label: 'Code' },
  media: { Icon: Images, label: 'Media' }
}

function Trigger({
  type,
  isDisabled,
  isOpen,
  onClick
}: {
  type: CardButtonProps['type']
  isDisabled?: boolean
  isOpen?: boolean
  onClick: () => void
}) {
  const { Icon, label } = META[type]
  const hasMenu = type === 'code' || type === 'media'

  return (
    <button
      type="button"
      className="flex flex-col justify-center items-center gap-1 disabled:opacity-50"
      disabled={isDisabled}
      aria-label={label}
      aria-haspopup={hasMenu ? 'menu' : undefined}
      aria-expanded={hasMenu ? !!isOpen : undefined}
      onClick={onClick}
    >
      <span className="w-8 h-8 flex justify-center items-center border-2 rounded-full">
        <Icon className="w-4 h-4 text-foreground" strokeWidth={3} />
      </span>
      <span className="text-foreground text-sm font-semibold">{label}</span>
    </button>
  )
}

function MenuButton({
  type,
  isDisabled,
  items
}: {
  type: 'code' | 'media'
  isDisabled?: boolean
  items: {
    key: string
    label: string
    icon?: ElementType
    onClick: () => void
  }[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative">
      <Trigger
        type={type}
        isDisabled={isDisabled}
        isOpen={isOpen}
        onClick={() => setIsOpen(v => !v)}
      />
      {isOpen && (
        <div
          role="menu"
          className="absolute left-1/2 bottom-full z-50 mb-1 min-w-[9rem] -translate-x-1/2 rounded-xl border border-border bg-card p-1 shadow-md"
        >
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                item.onClick()
                setIsOpen(false)
              }}
            >
              {item.icon && <item.icon className="size-3.5 shrink-0" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CardButton(props: CardButtonProps) {
  if (props.type === 'code') {
    return (
      <MenuButton
        type="code"
        isDisabled={props.isDisabled}
        items={CODE_LANG_OPTIONS.map(({ lang, label, icon }) => ({
          key: lang,
          label,
          icon,
          onClick: () => props.onSelectCode(lang)
        }))}
      />
    )
  }

  if (props.type === 'media') {
    return (
      <MenuButton
        type="media"
        isDisabled={props.isDisabled}
        items={[
          {
            key: 'image',
            label: 'Image',
            icon: ImagePlus,
            onClick: () => props.onSelectMedia('image')
          },
          {
            key: 'audio',
            label: 'Audio',
            icon: Volume2,
            onClick: () => props.onSelectMedia('audio')
          }
        ]}
      />
    )
  }

  return (
    <Trigger
      type={props.type}
      isDisabled={props.isDisabled}
      onClick={props.onClick}
    />
  )
}
