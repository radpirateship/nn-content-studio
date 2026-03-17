'use client'

import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  PenTool, 
  Code, 
  Check, 
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type { GenerationStep } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GenerationProgressProps {
  step: GenerationStep
  progress: number
  message: string
}

const STEPS: { key: GenerationStep; label: string; icon: React.ElementType }[] = [
  { key: 'generating-outline', label: 'Creating Outline', icon: FileText },
  { key: 'writing-content', label: 'Writing Content', icon: PenTool },
  { key: 'optimizing-html', label: 'Optimizing HTML', icon: Code },
  { key: 'ready-for-review', label: 'Ready for Review', icon: Check },
]

export function GenerationProgress({ step, progress, message }: GenerationProgressProps) {
  if (step === 'idle') return null

  const currentStepIndex = STEPS.findIndex(s => s.key === step)
  const isError = step === 'error'
  const isComplete = step === 'complete'
  const isPublishing = step === 'publishing'

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isError ? (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">Generation Error</span>
            </>
          ) : isComplete ? (
            <>
              <Check className="h-5 w-5 text-primary" />
              <span className="text-primary">Article Published</span>
            </>
          ) : isPublishing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Publishing to Shopify...</span>
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Generating Article</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Step Indicators */}
        {!isError && !isComplete && !isPublishing && (
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, index) => {
              const Icon = s.icon
              const isActive = s.key === step
              const isPast = currentStepIndex > index
              const isFuture = currentStepIndex < index && currentStepIndex !== -1

              return (
                <div
                  key={s.key}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition-colors',
                    isActive && 'bg-primary/10',
                    isPast && 'opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isActive && 'bg-primary text-primary-foreground',
                      isPast && 'bg-primary/20 text-primary',
                      isFuture && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isPast ? (
                      <Check className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs text-center',
                      isActive && 'font-medium text-foreground',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
