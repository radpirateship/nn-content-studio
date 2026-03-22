'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewId } from './app-sidebar'

interface PipelineStep {
  id: ViewId
  label: string
  done: boolean
}

interface PipelineStepperProps {
  steps: PipelineStep[]
  activeView: ViewId
  onNavigate: (view: ViewId) => void
}

export function PipelineStepper({ steps, activeView, onNavigate }: PipelineStepperProps) {
  return (
    <div
      className="flex items-center gap-1 px-6 py-2 border-b"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {steps.map((step, i) => {
        const isCurrent = step.id === activeView
        const isClickable = step.done || isCurrent

        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <div
                className="mx-2 h-px w-6"
                style={{ background: step.done ? 'var(--nn-accent)' : 'var(--border)' }}
              />
            )}
            <button
              onClick={() => isClickable && onNavigate(step.id)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                isCurrent && 'font-semibold',
                isClickable && !isCurrent && 'hover:bg-[var(--surface)]',
                !isClickable && 'cursor-default',
              )}
              style={{
                color: isCurrent
                  ? 'var(--nn-accent)'
                  : step.done
                    ? 'var(--text2)'
                    : 'var(--text4)',
                background: isCurrent ? 'var(--nn-accent-light)' : undefined,
              }}
            >
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-mono flex-shrink-0"
                style={{
                  border: '1.5px solid',
                  borderColor: step.done
                    ? 'var(--nn-accent)'
                    : isCurrent
                      ? 'var(--nn-accent)'
                      : 'var(--border)',
                  background: step.done ? 'var(--nn-accent-light)' : 'transparent',
                  color: step.done || isCurrent ? 'var(--nn-accent)' : 'var(--text4)',
                }}
              >
                {step.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {step.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
