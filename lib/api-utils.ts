import { NextResponse } from "next/server"
import type { ZodIssue, ZodType } from "zod"
import { logActivity } from "@/lib/activity-log"

type LogStatus = "success" | "error" | "warning"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function shouldRedactKey(key: string): boolean {
  return /token|secret|password|authorization|api[-_]?key|cookie/i.test(key)
}

export function redactSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item))
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        shouldRedactKey(key) ? "[REDACTED]" : redactSensitiveData(nestedValue),
      ])
    )
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 497)}...`
  }

  return value
}

export function summarizeIssues(issues: ZodIssue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body"
      return `${path}: ${issue.message}`
    })
    .join("; ")
}

export async function parseAndValidateJson<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }),
    }
  }

  const result = schema.safeParse(rawBody)
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Invalid request body",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: result.data }
}

export function logRouteEvent(
  action: string,
  opts: {
    category: string
    status?: LogStatus
    detail?: string
    metadata?: Record<string, unknown>
    durationMs?: number
  }
) {
  const metadata = opts.metadata ? (redactSensitiveData(opts.metadata) as Record<string, unknown>) : undefined

  logActivity(action, {
    category: opts.category,
    status: opts.status,
    detail: opts.detail,
    durationMs: opts.durationMs,
    metadata,
  })
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
