import type { ReactNode } from 'react'

type Props = {
  /** The small uppercase line above the heading, e.g. "What it costs". */
  label: string
  title: ReactNode
  lead?: ReactNode
  /** Left-aligned heads sit beside other content; centred is the default. */
  align?: 'center' | 'left'
}

/** The opening of a landing section: label, heading, accent bar and an optional lead. */
export function SectionHead({ label, title, lead, align = 'center' }: Props) {
  return (
    <div className={align === 'left' ? 'shead left' : 'shead'}>
      <span className="eyebrow">{label}</span>
      <h2 className="title">{title}</h2>
      <span className="bar" aria-hidden="true" />
      {lead && <p className="sub">{lead}</p>}
    </div>
  )
}
