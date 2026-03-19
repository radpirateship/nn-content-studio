'use client'

import { Check, Loader2 } from 'lucide-react'

export type RevampStep = 'input' | 'analyzing' | 'review' | 'generating' | 'enriching' | 'done'

interface StepDef {
  id: RevampStep
  label: string
  description: string
}

const STEPS: StepDef[] = [
  { id: 'input', label: 'Provide Content', description: 'Paste HTML, URL, or select a blog post' },
  { id: 'analyzing', label: 'Analyze', description: 'AI evaluates structure, gaps, and SEO' },
  { id: 'review', label: 'Review & Configure', description: 'Adjust outline, tone, and word count' },
  { id: 'generating', label: 'Generate Rewrite', description: 'AI produces the improved article' },
  { id: 'enriching', label: 'Enrich', description: 'Add internal links, images, and SEO' },
  { id: 'done', label: 'Publish', description: 'Review final article and publish to Shopify' },
]

function getStepStatus(step: StepDef, currentStep: RevampStep): 'done' | 'active' | 'upcoming' {
  const currentIdx = STEPS.findIndex(s => s.id === currentStep)
  const stepIdx = STEPS.findIndex(s => s.id === step.id)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'upcoming'
}

interface RevampStepperProps {
  currentStep: RevampStep
}

export function RevampStepper({ currentStep }: RevampStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full px-1 py-3">
      {STEPS.map((step, i) => {
        const status = getStepStatus(step, currentStep)
        return (
          <div key={step.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-mono font-semibold transition-all"
                style={{
                  background: status === 'done'
                    ? 'var(--nn-accent)'
                    : status === 'active'
                      ? 'var(--nn-accent-light)'
                      : 'var(--surface)',
                  color: status === 'done'
                    ? '#fff'
                    : status === 'active'
                      ? 'var(--nn-accent)'
                      : 'var(--text4)',
                  border: status === 'active' ? '2px solid var(--nn-accent)' : '2px solid transparent',
                }}
              >
                {status === 'done' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : status === 'active' && (currentStep === 'analyzing' || currentStep === 'generating') ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="mt-1.5 text-[10px] font-medium text-center leading-tight"
                style={{
                  color: status === 'done'
                    ? 'var(--nn-accent)'
                    : status === 'active'
                      ? 'var(--text1)'
                      : 'var(--text4)',
                }}
              >
                {step.label}
              </span>
              <span
                className="text-[9px] text-center leading-tight mt-0.5 max-w-[90px]"
                style={{
                  color: status === 'active' ? 'var(--text3)' : 'transparent',
                }}
              >
                {step.description}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className="h-[2px] flex-1 mx-1 rounded-full mt-[-20px]"
                style={{
                  background: getStepStatus(STEPS[i + 1], currentStep) === 'upcoming' && status !== 'done'
                    ? 'var(--border)'
                    : 'var(--nn-accent)',
                  opacity: status === 'done' ? 0.4 : 1,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
