import type { ReactNode } from 'react'
import './Card.css'

interface CardProps {
  className?: string
  children: ReactNode
}

export const Card = ({ className, children }: CardProps) => {
  return <div className={`card${className ? ` ${className}` : ''}`}>{children}</div>
}

