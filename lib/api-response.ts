/**
 * Standardized API response helpers.
 *
 * Use these in new routes and incrementally adopt in existing ones.
 * They ensure a consistent shape across all endpoints:
 *
 *   Success: { success: true, ...data, warning? }
 *   List:    { success: true, items: T[], count: number }
 *   Error:   { error: string, detail? }
 */

import { NextResponse } from "next/server";

/**
 * Return a success response, spreading `data` into the top level.
 * Optionally attach a warning string.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  meta?: { warning?: string }
): NextResponse {
  return NextResponse.json({
    success: true,
    ...data,
    ...(meta?.warning && { warning: meta.warning }),
  });
}

/**
 * Return a paginated list response.
 */
export function apiList<T>(items: T[], count?: number): NextResponse {
  return NextResponse.json({
    success: true,
    items,
    count: count ?? items.length,
  });
}

/**
 * Return a structured error response with a status code.
 */
export function apiError(
  message: string,
  status = 500,
  detail?: string
): NextResponse {
  return NextResponse.json(
    { error: message, ...(detail && { detail }) },
    { status }
  );
}
