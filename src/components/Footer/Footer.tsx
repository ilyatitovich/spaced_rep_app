import './Footer.css'

import type { ReactNode } from 'react'

export type FooterProps = {
  children: ReactNode
}

export default function Footer({ children }: FooterProps) {
  return <footer className="page-footer">{children}</footer>
}
