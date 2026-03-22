import { type NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 120

/**
 * AI-powered product selection for Ultimate Guides.
 *
 * After all content sections are generated, the client sends:
 *   - Full guide content (section summaries or assembled HTML)
 *   - All products available in the collection
 *   - Guide metadata (topic, title, etc.)
 *
 * Claude analyzes the guide content, reviews every product's specs/price,
 * and returns a curated selection of 4–8 products with:
 *   - Assigned roles (e.g. "Best Value", "Premium Choice", "Best for Beginners")
 *   - A short rationale for each pick
 *   - The featured-products intro HTML (2 paragraphs bridging guide → products)
 */

interface ProductCandidate {
  title: string
  handle: string
  price: string
  vendor: string
  description: string
  productType: string
  tags: string
  imageUrl: string
}

const SYSTEM_PROMPT = `You are a product curator for Naked Nutrition (nakednutrition.com), a premium e-commerce wellness brand.

Your job: Given the full content of an Ultimate Guide and a catalog of available products, select the BEST products to feature. The number to select depends on catalog size — you'll be told the range.

Selection criteria:
- Choose products that directly relate to what the guide discusses (types, use cases, price tiers)
- Ensure price diversity — include at least one accessible/value option AND one premium option
- Prefer products with images (imageUrl not empty)
- Prefer products with meaningful descriptions and specs
- Assign each product a unique, specific role — do NOT reuse roles
- The roles should feel natural and helpful to a reader deciding what to buy

Good roles (use these or similar): "Best Value", "Premium Choice", "Best for Beginners", "Best for Small Spaces", "Best for Athletes", "Commercial Grade", "Editor's Pick", "Most Versatile", "Best Splurge", "Best Budget Pick"
Bad roles: generic labels like "Option 1", "Good", "Recommended"

You MUST return valid JSON. No markdown fences, no explanation outside the JSON.`

function buildUserPrompt(
  guideTitle: string,
  topicShort: string,
  topicFull: string,
  sectionSummaries: Record<string, string>,
  products: ProductCandidate[]
): string {
  const summaryText = Object.entries(sectionSummaries)
    .map(([key, text]) => `### ${key}\n${text}`)
    .join('\n\n')

  const productList = products.map((p, i) =>
    `${i + 1}. HANDLE: "${p.handle}" | "${p.title}" by ${p.vendor} — $${p.price}${p.imageUrl ? ' [has image]' : ' [NO image]'}${p.description ? `\n   ${p.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}` : ''}${p.tags ? `\n   Tags: ${p.tags}` : ''}`
  ).join('\n')

  return `## Guide: "${guideTitle}"
Topic: ${topicFull}

## Guide Content Summary
${summaryText}

## Available Products (${products.length} total)
${productList}

---

Select ${products.length <= 8 ? `all ${products.length}` : '4–8'} products from the list above. Return this exact JSON structure:

{
  "selectedProducts": [
    {
      "handle": "product-handle-here",
      "role": "Best Value",
      "reason": "One sentence explaining why this product fits this role based on the guide content"
    }
  ],
  "introHtml": "<p>2–3 sentences bridging from the guide content to product recommendations. Reference what the reader learned about ${topicShort} and explain the selection criteria.</p>\\n<p>2–3 sentences on what you looked for: build quality, key specs discussed in the guide, safety features, and value for money. Be specific to ${topicShort}.</p>"
}

Rules:
- ${products.length <= 8 ? `Select ALL ${products.length} products — the catalog is small enough to feature every product` : 'Select between 4 and 8 products (prefer 6–8 for comprehensive coverage)'}
- Every "handle" must EXACTLY match a HANDLE value from the product list (copy-paste it)
- Every role must be unique — no duplicates
- The introHtml must NOT include product cards, prices, or individual descriptions
- Do NOT add an <h2> heading in the introHtml — the template handles that
- Prioritize products WITH images over those without`
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit("guide-select-products", { windowMs: 60_000, max: 5 })
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await request.json()
    const {
      guideTitle,
      topicShort,
      topicFull,
      sectionSummaries = {},
      products = [],
    } = body as {
      guideTitle: string
      topicShort: string
      topicFull: string
      sectionSummaries: Record<string, string>
      products: ProductCandidate[]
    }

    if (!guideTitle || !topicShort || products.length === 0) {
      return NextResponse.json(
        { error: 'guideTitle, topicShort, and products are required' },
        { status: 400 }
      )
    }

    const userPrompt = buildUserPrompt(
      guideTitle,
      topicShort,
      topicFull || topicShort,
      sectionSummaries,
      products
    )

    // Try up to 2 attempts — AI sometimes returns conversational text instead of JSON
    let result: { selectedProducts: Array<{ handle: string; role: string; reason: string }>; introHtml: string } | null = null
    let lastError = ''

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const promptToUse = attempt === 0
          ? userPrompt
          : `IMPORTANT: You must respond with ONLY valid JSON. No explanations, no commentary, no markdown. Just the raw JSON object.\n\n${userPrompt}`

        const raw = await callAI(SYSTEM_PROMPT, promptToUse, { maxTokens: 2048 })

        // Strip markdown fences if present
        let cleaned = raw
          .replace(/^```json?\n?/i, '')
          .replace(/\n?```$/g, '')
          .trim()

        // If the response contains JSON buried in text, try to extract it
        if (!cleaned.startsWith('{')) {
          const jsonMatch = cleaned.match(/\{[\s\S]*"selectedProducts"[\s\S]*\}/)
          if (jsonMatch) {
            cleaned = jsonMatch[0]
          }
        }

        result = JSON.parse(cleaned)
        break // Success — exit retry loop
      } catch (parseErr) {
        lastError = parseErr instanceof Error ? parseErr.message : String(parseErr)
        console.error(`[select-products] Attempt ${attempt + 1} failed to parse AI response:`, lastError)
      }
    }

    if (!result || !result.selectedProducts) {
      return NextResponse.json(
        { error: `AI did not return valid JSON after 2 attempts: ${lastError}` },
        { status: 500 }
      )
    }

    // Normalize handles for matching — AI often strips special chars like ® ™ etc.
    const normalizeHandle = (h: string) => h.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    const handleMap = new Map<string, string>()  // normalized → original
    for (const p of products) {
      handleMap.set(normalizeHandle(p.handle), p.handle)
      handleMap.set(p.handle.toLowerCase(), p.handle) // also map exact lowercase
    }

    // Match AI-returned handles to real handles (try exact first, then normalized)
    const validSelections = result.selectedProducts
      .map(sp => {
        const exactMatch = handleMap.get(sp.handle.toLowerCase())
        const normalizedMatch = handleMap.get(normalizeHandle(sp.handle))
        const realHandle = exactMatch || normalizedMatch
        if (realHandle) return { ...sp, handle: realHandle }
        console.warn(`[select-products] AI handle "${sp.handle}" did not match any product`)
        return null
      })
      .filter(Boolean) as Array<{ handle: string; role: string; reason: string }>

    // Require at least 2 valid products — partial results are still usable
    const minRequired = Math.min(2, products.length)
    if (validSelections.length < minRequired) {
      return NextResponse.json(
        {
          error: `AI only selected ${validSelections.length} valid products (minimum ${minRequired}). Some handles may not have matched.`,
          partialResult: { ...result, selectedProducts: validSelections },
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      selectedProducts: validSelections,
      introHtml: result.introHtml || '',
    })
  } catch (error) {
    console.error('[select-products]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Product selection failed' },
      { status: 500 }
    )
  }
}
