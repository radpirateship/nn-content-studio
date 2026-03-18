'use client'

import React from 'react'
import { Pencil, HelpCircle, Sparkles, Database, Check, Loader2, AlertCircle } from 'lucide-react'

interface RevampGenerationProgressProps {
  currentStep: 'idle' | 'content' | 'faq' | 'polishing' | 'saving' | 'done' | 'error'
  errorMessage?: string
}

const STEPS = [
  {
    key: 'content',
    number: 1,
    label: 'Rewriting Article',
    description: 'AI is rewriting the article body with improved structure and SEO...',
    icon: Pencil,
  },
  {
    key: 'faq',
    number: 2,
    label: 'Generating FAQ',
    description: 'Creating 8 targeted FAQ questions from real search queries...',
    icon: HelpCircle,
  },
  {
    key: 'polishing',
    number: 3,
    label: 'Polishing & Assembly',
    description: 'Adding navigation, product cards, and schema markup...',
    icon: Sparkles,
  },
  {
    key: 'saving',
    number: 4,
    label: 'Saving to Database',
    description: 'Saving your revamped article...',
    icon: Database,
  },
]

export function RevampGenerationProgress({ currentStep, errorMessage }: RevampGenerationProgressProps) {
  if (currentStep === 'idle') return null

  const isError = currentStep === 'error'
  const isDone = currentStep === 'done'

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-8">
        {isError ? (
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6" style={{ color: '#c53030' }} />
            <div>
              <h2 className="text-[16px] font-semibold" style={{ color: '#c53030' }}>
                Generation Error
              </h2>
              {errorMessage && (
                <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        ) : isDone ? (
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--nn-accent)' }}
            >
              <Check className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text1)' }}>
              Article Generated Successfully
            </h2>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--nn-accent)' }} />
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text1)' }}>
              Generating Your Article
            </h2>
          </div>
        )}
      </div>

      {/* Steps Container */}
      {!isError && !isDone && (
        <div className="space-y-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.key
            const isDone = currentStepIndex > index
            const isFuture = currentStepIndex < index

            return (
              <div key={step.key} className="flex gap-4">
                {/* Step Circle & Line */}
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDone || isActive ? 'var(--nn-accent)' : 'var(--surface)',
                      border: isFuture ? `2px solid var(--border)` : undefined,
                      color: isDone || isActive ? 'white' : 'var(--text3)',
                    }}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-[12px] font-semibold">{step.number}</span>
                    )}
                  </div>

                  {/* Connecting Line (not on last step) */}
                  {index < STEPS.length - 1 && (
                    <div
                      className="w-0.5 my-2 flex-1"
                      style={{
                        height: '28px',
                        background: isDone ? 'var(--nn-accent)' : 'var(--border)',
                      }}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className="pt-0.5 flex-1">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: isActive ? 'var(--nn-accent)' : isDone ? 'var(--text1)' : 'var(--text3)' }}
                  >
                    {step.label}
                  </p>
                  <p
                    className="text-[12px] mt-0.5"
                    style={{
                      color: isActive || isDone ? 'var(--text2)' : 'var(--text4)',
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Error State - Retry Info */}
      {isError && (
        <div
          className="mt-6 p-4 rounded-lg border"
          style={{ background: 'var(--bg)', borderColor: '#fcbaba' }}
        >
          <p className="text-[12px]" style={{ color: 'var(--text2)' }}>
            Please review your settings and try again. If the problem persists, check your API configuration.
          </p>
        </div>
      )}

      {/* Done State - Success Message */}
      {isDone && (
        <div
          className="mt-6 p-4 rounded-lg border"
          style={{ background: 'var(--bg)', borderColor: 'var(--nn-accent)' }}
        >
          <p className="text-[12px]" style={{ color: 'var(--text2)' }}>
            Your article has been revamped with improved structure, new content, FAQ section, and schema markup. Ready to publish!
          </p>
        </div>
      )}
    </div>
  )
}
