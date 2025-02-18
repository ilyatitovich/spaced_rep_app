import './Header.css'

import { type ReactNode } from 'react'

type HeaderProps = {
  withNav?: boolean
  children: ReactNode
}

export default function Header({ withNav = true, children }: HeaderProps) {
  return (
    <header className="page-header">
      {withNav ? <nav> {children}</nav> : children}
    </header>
  )
}
