// Image generation route — generates contextual images for article sections
// Runs AFTER content generation, inserts images into the body HTML
import { type NextRequest, NextResponse } from "next/server"
import { callAI } from "@/lib/ai"
import { generateImageWithModel } from "@/lib/imageGeneration"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

export const maxDuration = 120

// ── Types ────────────────────────────────────────────────────────────────────

interface ImageGenerateRequest {
  bodyContent: string
  keyword: string
  category: string
  titleTag?: string
  maxImages?: number
}

interface ImageStoryboardItem {
  sectionId: string
  description: string
  style: string
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit("revamp-images", { windowMs: 60_000, max: 3 })
    if (!limit.allowed) return rateLimitResponse(limit)

    const body: ImageGenerateRequest = await request.json()

    const {
      bodyContent,
      keyword,
      category,
      titleTag,
      maxImages = 3,
    } = body

    // Step 1: Ask AI to create an image storyboard from the article content
    console.log("[revamp/images] Creating image storyboard...")

    const storyboardSystem = `You are an art director for Naked Nutrition, a premium supplement brand. You create image briefs for article illustrations. The brand aesthetic is clean, modern, and scientific — think infographic-style with dark backgrounds, bright accent colors (#00A3FF blue, #00C853 green), and professional composition.`

    const storyboardUser = `Analyze this article body and create exactly ${maxImages} image descriptions for contextual illustrations to insert between sections.

ARTICLE KEYWORD: ${keyword}
ARTICLE TITLE: ${titleTag || keyword}
CATEGORY: ${category}

ARTICLE BODY HTML:
${bodyContent.substring(0, 4000)}

Return a JSON array of image objects. Each object must have:
- "sectionId": the id attribute of the <section> AFTER which the image should be inserted
- "description": a detailed image generation prompt (2-3 sentences) for a clean, professional infographic or illustration. NO text overlays. Focus on visual representations of concepts.
- "style": one of "infographic", "diagram", "illustration", "photograph"

Rules:
- Space images evenly through the article — never put 2 images in a row
- First image should go after the 2nd or 3rd section
- Do NOT place images after the Key Takeaways section
- Focus on visually explaining concepts (how things work, comparisons, processes)

Return ONLY the JSON array, no markdown fences.`

    const storyboardRaw = await callAI(storyboardSystem, storyboardUser, { maxTokens: 1500 })

    let storyboard: ImageStoryboardItem[] = []
    try {
      const cleaned = storyboardRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
      storyboard = JSON.parse(cleaned)
      if (!Array.isArray(storyboard)) storyboard = []
    } catch {
      console.warn("[revamp/images] Failed to parse storyboard, skipping images")
      return NextResponse.json({ bodyContent, images: [] })
    }

    console.log(`[revamp/images] Storyboard: ${storyboard.length} images planned`)

    // Step 2: Generate images in parallel (up to maxImages)
    const imageSlots = storyboard.slice(0, maxImages)

    const imagePromises = imageSlots.map(async (slot, i) => {
      const fullPrompt = `Create a clean, professional ${slot.style} for a nutrition/supplement article. Brand colors: deep black (#1a1a1a), electric blue (#00A3FF), vibrant green (#00C853). Modern, minimalist style with no text overlays.

${slot.description}

Style: High-quality ${slot.style}, white or dark background, suitable for a premium health brand website. 16:9 aspect ratio.`

      console.log(`[revamp/images] Generating image ${i + 1}/${imageSlots.length}: ${slot.style}`)

      try {
        const result = await generateImageWithModel(fullPrompt, "gemini-3.1-flash-image-preview", {
          aspectRatio: "16:9",
        })

        if (result?.url) {
          return { ...slot, imageUrl: result.url, success: true }
        }
        return { ...slot, imageUrl: "", success: false }
      } catch (error) {
        console.error(`[revamp/images] Image ${i + 1} failed:`, error)
        return { ...slot, imageUrl: "", success: false }
      }
    })

    const imageResults = await Promise.all(imagePromises)
    const successfulImages = imageResults.filter((r) => r.success && r.imageUrl)

    console.log(`[revamp/images] Generated ${successfulImages.length}/${imageSlots.length} images successfully`)

    // Step 3: Insert images into body content
    let updatedContent = bodyContent

    for (const img of successfulImages) {
      const sectionClosePattern = new RegExp(
        `(<section[^>]*id=["']${img.sectionId}["'][^>]*>[\\s\\S]*?</section>)`,
        "i"
      )

      const imageHtml = `\n<figure class="nn-content-image">
<img src="${img.imageUrl}" alt="${img.description.substring(0, 120)}" loading="lazy" />
</figure>\n`

      const match = updatedContent.match(sectionClosePattern)
      if (match) {
        const insertAt = updatedContent.indexOf(match[0]) + match[0].length
        updatedContent = updatedContent.slice(0, insertAt) + imageHtml + updatedContent.slice(insertAt)
        console.log(`[revamp/images] Inserted image after section: ${img.sectionId}`)
      }
    }

    return NextResponse.json({
      bodyContent: updatedContent,
      images: successfulImages.map((r) => ({
        sectionId: r.sectionId,
        url: r.imageUrl,
        description: r.description,
        style: r.style,
      })),
    })
  } catch (error) {
    console.error("[revamp/generate/images] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate images" },
      { status: 500 }
    )
  }
}
