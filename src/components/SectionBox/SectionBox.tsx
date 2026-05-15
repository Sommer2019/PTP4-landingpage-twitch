import type { ReactNode } from 'react'
import './SectionBox.css'

interface SectionBoxProps {
  title?: string
  children: ReactNode
  className?: string
}

/** Abschnitts-Container mit optionaler Ueberschrift und Raster-Layout fuer die Kinder. */
export default function SectionBox({ title, children, className = '' }: SectionBoxProps) {
  return (
    <section className={`section-box ${className}`} aria-label={title}>
      {title && <h2 className="section-box-title">{title}</h2>}
      <div className="section-box-grid">{children}</div>
    </section>
  )
}

