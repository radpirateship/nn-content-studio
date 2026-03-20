import { type NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'

/**
 * POST /api/ultimate-guides/draft-image-prompts
 *
 * Guide-specific fork of /api/articles/draft-image-prompts.
 *
 * Key differences from the article version:
 * 1. Eligible sections are a fixed list (not all H2s) — guides have a known structure
 * 2. Excluded sections: hero, quick-nav, key-takeaways, buying-guide, top-picks,
 *    related-articles, related-guides, faq and below
 * 3. Featured image → goes to the hero <img> src, NOT Shopify article.image field
 * 4. System prompt uses "evergreen product guide" framing, not "blog article" framing
 */

// Sections eligible for image placement (fixed for all ultimate guides)
const ELIGIBLE_SECTION_IDS = [
  'what-is',
  'how-it-works',
  'types',
  'health-benefits',
  'how-to-use',
  'safety',
]

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, guideTitle, topicShort, collectionSlug } = await request.json()

    if (!htmlContent) {
      return NextResponse.json({ error: 'htmlContent is required' }, { status: 400 })
    }

    // Extract plain text for AI context (strip styles/scripts)
    const plainText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    // Build the eligible section list from the fixed set,
    // but only include ones that actually appear in the HTML
    const sections: { id: string; text: string }[] = []
    for (const id of ELIGIBLE_SECTION_IDS) {
      const regex = new RegExp(`<h2[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/h2>`, 'i')
      const match = regex.exec(htmlContent)
      if (match) {
        const text = match[1].replace(/<[^>]+>/g, '').trim()
        sections.push({ id, text })
      } else {
        // Section ID not found — still include it with a derived label
        // (guides may use slightly different IDs)
        const label = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        sections.push({ id, text: label })
      }
    }

    const sectionList = sections.map((s, i) =>
      `  ${i + 1}. id="${s.id}" — "${s.text}"`
    ).join('\n')

    const systemPrompt = `You are an expert Technical Illustrator and Brand Visualist for Naked Nutrition (nakednutrition.com),
a premium supplement brand selling protein powder, collagen peptides, creatine, pre-workout, BCAAs, greens, and sports nutrition products.

Your task: Draft image concepts for an EVERGREEN PRODUCT GUIDE — one hero image plus one technical image per eligible section. (not a news article or blog post).
Images must be timeless, educational, and professional — no trend references, no dates.

1 HERO IMAGE (featured):
- A cinematic, high-quality product lifestyle or studio shot
- Clean white or deep navy background
- The product at its best — aspirational but real
- Must end with: Include the text "${guideTitle}" as large, bold, elegant white text rendered directly within the image — centered near the bottom third, on a dark semi-transparent background strip.

TECHNICAL/EDUCATIONAL IMAGES (one per eligible section):
- Medical illustrations, cross-section diagrams, vector infographics, isometric technical drawings
- Each explains a CONCEPT or MECHANISM relevant to the section it's assigned to
- Use Navy Blue (#0B1A5D) for main structures, Red for heat/action arrows, Blue for cool/flow arrows, White background
- No people, no lifestyle — pure information graphics
- Each image should be distinctly different in visual approach (diagram, cross-section, infographic, comparison chart, etc.)

RULES:
- Assign EXACTLY ONE image to EACH eligible section — every section gets an image
- Hero goes to "what-is" section (first content section)
- Technical images go to all remaining eligible sections
- Never assign images to: hero, quick-nav, key-takeaways, top-picks, buying-guide, related-articles, related-guides, faq

OUTPUT: Return ONLY a valid JSON array with one object per eligible section (hero + all technical). No markdown fences. No explanation.
Each object:
{
  "label": "Short label e.g. 'Hero: Cold Plunge Lifestyle' or 'Figure 1: Vasoconstriction Mechanism'",
  "prompt": "Detailed image description 80-150 words — NO style instructions, those are added separately",
  "altText": "SEO-friendly alt text 10-20 words, specific to content",
  "type": "featured" or "technical",
  "targetSectionId": "exact id from the list below"
}`

    const userPrompt = `GUIDE TITLE: "${guideTitle}"
TOPIC: "${topicShort}"
CATEGORY: "${collectionSlug || topicShort}"

ELIGIBLE SECTIONS (use these exact ids for targetSectionId):
${sectionList}

GUIDE CONTENT SUMMARY:
${plainText}

Draft image concepts: 1 hero/featured for what-is + 1 technical for EACH remaining eligible section. Every section must get an image.`

    let rawText = await callAI(systemPrompt, userPrompt, { maxTokens: 4000 })

    // Strip markdown fences if present
    rawText = rawText
      .replace(/^\`\`\`json?\n?/i, '')
      .replace(/\n?\`\`\`$/i, '')
      .trim()

    let concepts
    try {
      concepts = JSON.parse(rawText)
    } catch {
      console.error('[guide-draft-image-prompts] Failed to parse JSON:', rawText.slice(0, 400))
      return NextResponse.json(
        { error: 'AI returned invalid JSON for image concepts' },
        { status: 500 }
      )
    }

    // Normalize and validate
    const usedSections = new Set<string>()
    const sectionIds = sections.map(s => s.id)

    const normalized = (Array.isArray(concepts) ? concepts : []).map(
      (c: {
        label?: string
        prompt?: string
        type?: string
        targetSectionId?: string
        altText?: string
      }, i: number) => {
        let targetId = c.targetSectionId || ''

        // Hero image always goes to what-is (first eligible section)
        if (c.type === 'featured' || c.type === 'hero') {
          targetId = 'what-is'
        }

        // Validate targetId — must be in eligible list and not already used
        if (!sectionIds.includes(targetId) || usedSections.has(targetId)) {
          targetId = sectionIds.find(id => !usedSections.has(id)) || sectionIds[0] || ''
        }
        if (targetId) usedSections.add(targetId)

        const rawLabel = c.label || `Image ${i + 1}`
        const fallbackAlt = rawLabel
          .replace(/^(featured|hero|figure\s*\d*)\s*[:–\-]\s*/i, '')
          .trim()

        return {
          id: `img-${Date.now()}-${i}`,
          label: rawLabel,
          prompt: c.prompt || '',
          altText: c.altText || fallbackAlt,
          type: (c.type === 'featured' || c.type === 'hero')
            ? 'featured' as const
            : 'technical' as const,
          status: 'draft' as const,
          targetSectionId: targetId,
        }
      }
    ).filter((c: { prompt: string }) => c.prompt)

    return NextResponse.json({
      concepts: normalized,
      count: normalized.length,
      success: true,
    })
  } catch (error) {
    console.error('[guide-draft-image-prompts]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to draft image prompts' },
      { status: 500 }
    )
  }
}
