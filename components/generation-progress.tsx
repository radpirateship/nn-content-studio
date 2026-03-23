'use client'

import React, { useState, useEffect, useRef } from "react"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  FileText,
  PenTool,
  Code,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react'
import type { GenerationStep } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GenerationProgressProps {
  step: GenerationStep
  progress: number
  message: string
  /** Called when the user clicks "Try Again" after an error */
  onRetry?: () => void
  /** Called when the user dismisses the progress card (error or complete) */
  onDismiss?: () => void
}

const STEPS: { key: GenerationStep; label: string; icon: React.ElementType }[] = [
  { key: 'generating-outline', label: 'Creating Outline', icon: FileText },
  { key: 'writing-content', label: 'Writing Content', icon: PenTool },
  { key: 'optimizing-html', label: 'Optimizing HTML', icon: Code },
  { key: 'ready-for-review', label: 'Ready for Review', icon: Check },
]

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}

export function GenerationProgress({ step, progress, message, onRetry, onDismiss }: GenerationProgressProps) {
  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActive = step !== 'idle' && step !== 'complete' && step !== 'error'

  useEffect(() => {
    if (isActive) {
      // Reset on new generation
      setElapsed(0)
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive])

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
          {/* Elapsed time */}
          {(isActive || isPublishing) && (
            <span className="ml-auto flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
            </span>
          )}
          {(isComplete || isError) && elapsed > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {formatElapsed(elapsed)} total
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Error actions */}
        {isError && (onRetry || onDismiss) && (
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="default" onClick={onRetry} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            )}
          </div>
        )}

        {/* Step Indicators */}
        {!isError && !isComplete && !isPublishing && (
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, index) => {
              const Icon = s.icon
              const isStepActive = s.key === step
              const isPast = currentStepIndex > index
              const isFuture = currentStepIndex < index && currentStepIndex !== -1

              return (
                <div
                  key={s.key}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition-colors',
                    isStepActive && 'bg-primary/10',
                    isPast && 'opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isStepActive && 'bg-primary text-primary-foreground',
                      isPast && 'bg-primary/20 text-primary',
                      isFuture && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isPast ? (
                      <Check className="h-4 w-4" />
                    ) : isStepActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs text-center',
                      isStepActive && 'font-medium text-foreground',
                      !isStepActive && 'text-muted-foreground'
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
