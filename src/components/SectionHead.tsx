import type { ReactNode } from 'react'

type Props = {
  /** The small uppercase line above the heading, e.g. "What it costs". */
  label: string
  title: ReactNode
  lead?: ReactNode
}

/** The opening of a landing section: label, heading and an optional lead, left-aligned. */
export function SectionHead({ label, title, lead }: Props) {
  return (
    <div className="shead">
      <span className="eyebrow">{label}</span>
      <h2 className="title">{title}</h2>
      {lead && <p className="sub">{lead}</p>}
    </div>
  )
}
