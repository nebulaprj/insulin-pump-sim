import type { ReactNode } from 'react'

export type StatusBadgeVariant =
  | 'on'
  | 'off'
  | 'allowed'
  | 'blocked'
  | 'suspended'
  | 'warning'
  | 'critical'

interface StatusBadgeProps {
  variant: StatusBadgeVariant
  children: ReactNode
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge-${variant}`}>
      <span className="status-badge-dot" />
      {children}
    </span>
  )
}