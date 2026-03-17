import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ultimate-guides/validate-schema
 *
 * Accepts the assembled guide HTML and validates all embedded JSON-LD
 * schema blocks for common issues before publishing.
 *
 * Returns { valid: boolean, errors: SchemaError[], warnings: SchemaWarning[] }
 */

interface SchemaIssue {
  schema: string          // e.g. "Article", "FAQPage", "ItemList"
  field: string
  message: string
}

interface ValidationResult {
  valid: boolean
  errors: SchemaIssue[]
  warnings: SchemaIssue[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractJsonLdBlocks(html: string): Array<{ raw: string; parsed: unknown }> {
  const blocks: Array<{ raw: string; parsed: unknown }> = []
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = regex.exec(html)) !== null) {
    const raw = m[1].trim()
    try {
      blocks.push({ raw, parsed: JSON.parse(raw) })
    } catch {
      blocks.push({ raw, parsed: null })
    }
  }
  return blocks
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

// ── Validators per schema type ───────────────────────────────────────────────

function validateArticle(obj: Record<string, unknown>, errors: SchemaIssue[], warnings: SchemaIssue[]) {
  const t = 'Article'

  if (!isNonEmptyString(obj.headline))
    errors.push({ schema: t, field: 'headline', message: 'Missing or empty headline' })

  if (!isNonEmptyString(obj.datePublished))
    errors.push({ schema: t, field: 'datePublished', message: 'Missing datePublished — Google requires this' })
  else if (!/^\d{4}-\d{2}-\d{2}/.test(obj.datePublished as string))
    warnings.push({ schema: t, field: 'datePublished', message: 'datePublished should be ISO 8601 format (YYYY-MM-DD)' })

  if (!isNonEmptyString(obj.dateModified))
    warnings.push({ schema: t, field: 'dateModified', message: 'dateModified is recommended for Article schema' })

  if (!obj.author || typeof obj.author !== 'object')
    errors.push({ schema: t, field: 'author', message: 'Missing author object' })
  else {
    const author = obj.author as Record<string, unknown>
    if (!isNonEmptyString(author.name))
      errors.push({ schema: t, field: 'author.name', message: 'Author name is required' })
  }

  if (!obj.publisher || typeof obj.publisher !== 'object')
    warnings.push({ schema: t, field: 'publisher', message: 'Missing publisher object' })

  if (!isNonEmptyString(obj.image))
    warnings.push({ schema: t, field: 'image', message: 'Article image is recommended for rich results' })
}

function validateBreadcrumbList(obj: Record<string, unknown>, errors: SchemaIssue[], warnings: SchemaIssue[]) {
  const t = 'BreadcrumbList'
  const items = obj.itemListElement

  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ schema: t, field: 'itemListElement', message: 'BreadcrumbList must have at least one item' })
    return
  }

  items.forEach((item: Record<string, unknown>, i: number) => {
    if (!item.name && !isNonEmptyString(item.name as unknown))
      errors.push({ schema: t, field: `item[${i}].name`, message: `Breadcrumb item ${i + 1} is missing a name` })
    if (item.position === undefined)
      warnings.push({ schema: t, field: `item[${i}].position`, message: `Breadcrumb item ${i + 1} is missing position` })
  })
}

function validateFAQPage(obj: Record<string, unknown>, errors: SchemaIssue[], warnings: SchemaIssue[]) {
  const t = 'FAQPage'
  const entities = obj.mainEntity

  if (!Array.isArray(entities) || entities.length === 0) {
    errors.push({ schema: t, field: 'mainEntity', message: 'FAQPage must have at least one Question' })
    return
  }

  entities.forEach((entity: Record<string, unknown>, i: number) => {
    if (!isNonEmptyString(entity.name))
      errors.push({ schema: t, field: `question[${i}].name`, message: `FAQ question ${i + 1} is missing text` })

    const answer = entity.acceptedAnswer as Record<string, unknown> | undefined
    if (!answer || !isNonEmptyString(answer?.text))
      errors.push({ schema: t, field: `question[${i}].acceptedAnswer`, message: `FAQ question ${i + 1} is missing an answer` })
  })

  if (entities.length < 3)
    warnings.push({ schema: t, field: 'mainEntity', message: `Only ${entities.length} FAQ pair(s) — Google recommends 3+ for rich results` })
}

function validateItemList(obj: Record<string, unknown>, errors: SchemaIssue[], warnings: SchemaIssue[]) {
  const t = 'ItemList'
  const items = obj.itemListElement

  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ schema: t, field: 'itemListElement', message: 'ItemList has no products' })
    return
  }

  items.forEach((item: Record<string, unknown>, i: number) => {
    if (!isNonEmptyString(item.name))
      errors.push({ schema: t, field: `product[${i}].name`, message: `Product ${i + 1} is missing a name` })

    const offers = item.offers as Record<string, unknown> | undefined
    if (!offers) {
      errors.push({ schema: t, field: `product[${i}].offers`, message: `Product ${i + 1} has no offers/pricing` })
    } else {
      if (!isNonEmptyString(offers.priceCurrency))
        errors.push({ schema: t, field: `product[${i}].priceCurrency`, message: `Product ${i + 1} is missing priceCurrency` })
      if (offers.price === undefined || offers.price === null || offers.price === '')
        errors.push({ schema: t, field: `product[${i}].price`, message: `Product ${i + 1} is missing price` })
    }
  })
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json()

    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'html body is required' }, { status: 400 })
    }

    const blocks = extractJsonLdBlocks(html)
    const errors: SchemaIssue[] = []
    const warnings: SchemaIssue[] = []

    if (blocks.length === 0) {
      errors.push({ schema: 'General', field: 'JSON-LD', message: 'No JSON-LD schema blocks found in HTML' })
      return NextResponse.json({ valid: false, errors, warnings } satisfies ValidationResult)
    }

    // Check for parse failures
    blocks.forEach((block, i) => {
      if (block.parsed === null) {
        errors.push({ schema: 'General', field: `block[${i}]`, message: 'Invalid JSON — failed to parse' })
      }
    })

    // Validate each parsed schema
    const schemaTypes = new Set<string>()

    for (const block of blocks) {
      if (!block.parsed || typeof block.parsed !== 'object') continue
      const obj = block.parsed as Record<string, unknown>
      const type = (obj['@type'] as string) || ''
      schemaTypes.add(type)

      switch (type) {
        case 'Article':
          validateArticle(obj, errors, warnings)
          break
        case 'BreadcrumbList':
          validateBreadcrumbList(obj, errors, warnings)
          break
        case 'FAQPage':
          validateFAQPage(obj, errors, warnings)
          break
        case 'ItemList':
          validateItemList(obj, errors, warnings)
          break
        default:
          warnings.push({ schema: type || 'Unknown', field: '@type', message: `Unrecognized schema type: "${type}"` })
      }
    }

    // Check for expected schemas
    if (!schemaTypes.has('Article'))
      warnings.push({ schema: 'General', field: 'Article', message: 'No Article schema found — recommended for guides' })

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[validate-schema POST]', error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
