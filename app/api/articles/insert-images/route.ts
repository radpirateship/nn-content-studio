import { type NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { extractImageUrl } from "@/lib/imageUtils";

// Allow large request bodies (Gemini images are base64 data URIs ~200KB each)
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, htmlContent, images } = body;

    console.log('[insert-images] Received request:', {
      articleId,
      htmlContentLength: htmlContent?.length || 0,
      imageCount: images?.length || 0,
      imageUrlPrefixes: images?.map((img: { imageUrl?: string }) => img.imageUrl?.substring(0, 30) + '...'),
    });

    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images to insert" }, { status: 400 });
    }

    let enrichedHTML = htmlContent;
    let insertedCount = 0;

    // Step 1: Clean up any legacy placeholder artifacts
    enrichedHTML = enrichedHTML.replace(/<img[^>]*src="?\[IMAGE_PLACEHOLDER_\d+\]"?[^>]*\/?>/gi, '');
    enrichedHTML = enrichedHTML.replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, '');

    // Step 2: Strip any images that leaked inside product card blocks
    enrichedHTML = enrichedHTML.replace(
      /(<div[^>]*class="[^"]*nn-product-card[^"]*"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>)/gi,
      (match: string) => match.replace(/<figure[^>]*class="nn-content-image"[^>]*>[\s\S]*?<\/figure>/gi, '')
    );

    // Step 3: Insert images by targetSectionId or label-based matching (max 1 per section)
    const sectionsWithImages = new Set<string>();
    for (const img of images) {
      if (!img.imageUrl) continue;

      const cleanUrl = extractImageUrl(img.imageUrl);
      if (!cleanUrl) {
        console.error(`[insert-images] Skipping — could not extract URL from:`, (img.imageUrl || '').slice(0, 60));
        continue;
      }

      const altText = (img.altText || img.label || 'Article illustration').replace(/"/g, '&quot;');
      const figureTag = `\n<figure class="nn-content-image"><img src="${cleanUrl}" alt="${altText}" loading="lazy" /></figure>\n`;

      let inserted = false;

      // Primary: match by targetSectionId (max 1 image per section)
      if (img.targetSectionId && !sectionsWithImages.has(img.targetSectionId)) {
        const escapedId = img.targetSectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sectionRegex = new RegExp(
          `(<h2[^>]*id="${escapedId}"[^>]*>[\\s\\S]*?<\\/h2>)`, 'i'
        );
        const sectionMatch = sectionRegex.exec(enrichedHTML);
        if (sectionMatch) {
          const insertPos = sectionMatch.index + sectionMatch[0].length;
          // Guard: don't insert inside product cards
          const before = enrichedHTML.slice(Math.max(0, insertPos - 500), insertPos);
          if (!before.includes('nn-product-card') && !before.includes('featured-products')) {
            enrichedHTML = enrichedHTML.slice(0, insertPos) + figureTag + enrichedHTML.slice(insertPos);
            sectionsWithImages.add(img.targetSectionId);
            insertedCount++;
            inserted = true;
            console.log(`[insert-images] Inserted "${img.label}" after section "${img.targetSectionId}"`);
          }
        }
      }

      // Fallback: label-based heading match
      if (!inserted && img.label) {
        const cleanLabel = (img.label || '')
          .replace(/^(featured|hero|figure\s*\d*|content|technical|lifestyle|comparison|infographic)\s*[:–\-]\s*/i, '')
          .trim()
          .toLowerCase();
        const labelWords = cleanLabel.split(/\s+/).filter((w: string) => w.length > 3);
        const headingRegex = /(<h2[^>]*>)(.*?)(<\/h2>)/gi;
        let match;
        let bestMatch: { index: number } | null = null;
        let bestScore = 0;

        while ((match = headingRegex.exec(enrichedHTML)) !== null) {
          const before = enrichedHTML.slice(Math.max(0, match.index - 300), match.index);
          if (before.includes('nn-product-card') || before.includes('featured-products')) continue;

          const headingText = match[2].replace(/<[^>]*>/g, '').toLowerCase();
          const score = labelWords.filter((w: string) => headingText.includes(w)).length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { index: match.index + match[0].length };
          }
        }

        if (bestMatch && bestScore >= Math.min(2, labelWords.length)) {
          enrichedHTML = enrichedHTML.slice(0, bestMatch.index) + figureTag + enrichedHTML.slice(bestMatch.index);
          insertedCount++;
          inserted = true;
          console.log(`[insert-images] Inserted "${img.label}" via label match (score: ${bestScore})`);
        }
      }

      if (!inserted) {
        console.log(`[insert-images] Could not place "${img.label}" — no matching section found`);
      }
    }

    // Update database
    let dbSaved = true;
    if (articleId && insertedCount > 0) {
      try {
        const sql = getSQL();
        await sql`
          UPDATE articles
          SET html_content = ${enrichedHTML},
              has_images = true,
              image_count = ${insertedCount},
              updated_at = NOW()
          WHERE id = ${articleId}
        `;
      } catch (dbError) {
        console.error("Failed to update article in DB:", dbError);
        dbSaved = false;
      }
    }

    return NextResponse.json({
      htmlContent: enrichedHTML,
      imageCount: insertedCount,
      success: true,
      ...(dbSaved === false && { warning: "Images were inserted into the HTML but the database update failed. Your changes may not persist after refresh." }),
    });
  } catch (error) {
    console.error("Insert images error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to insert images" },
      { status: 500 }
    );
  }
}
