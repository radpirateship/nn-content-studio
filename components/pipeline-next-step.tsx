'use client'

import { ArrowRight, Zap } from 'lucide-react'

interface PipelineNextStepProps {
  /** Label for the next step, e.g. "Internal Links" */
  nextLabel: string
  /** Callback to navigate to the next step */
  onNext: () => void
  /** Optional callback for "Run full pipeline" auto-mode */
  onAutoRun?: () => void
  /** Optional message shown above the buttons */
  message?: string
}

export function PipelineNextStep({ nextLabel, onNext, onAutoRun, message }: PipelineNextStepProps) {
  return (
    <div
      className="flex items-center justify-between border-t px-6 py-3"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
        {message || 'Continue to the next step in the pipeline'}
      </span>
      <div className="flex items-center gap-2">
        {onAutoRun && (
          <button
            onClick={onAutoRun}
            className="btn-outline flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
          >
            <Zap className="h-3.5 w-3.5" />
            Run remaining steps
          </button>
        )}
        <button
          onClick={onNext}
          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
        >
          Next: {nextLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
