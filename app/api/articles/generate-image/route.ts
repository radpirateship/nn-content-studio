import sharp from "sharp";
import { type NextRequest, NextResponse } from "next/server";
import { generateImageWithModel, ImageGenerationError, type ImageModel } from "@/lib/imageGeneration";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

/**
 * POST /api/articles/generate-image
 *
 * Single image generation for the storyboard.
 * Uses Gemini image generation.
 *
 *   featured  -> realistic_image style (Shopify featured_image)
 *   technical -> digital_illustration style
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit("generate-image", { windowMs: 60_000, max: 5 });
    if (!limit.allowed) return rateLimitResponse(limit);

    const { prompt, conceptId, imageType = 'technical', title } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const imageModel: ImageModel = 'gemini-3.1-flash-image-preview';
    const isFeatured = imageType === 'featured';
    const styleUsed = isFeatured ? 'realistic_image' : 'digital_illustration';

    // Bake article title into the prompt for featured images — no Sharp text overlay needed
    const finalPrompt = (isFeatured && title)
      ? `${prompt}. Include the article title "${title}" as bold white typographic text prominently overlaid on the image.`
      : prompt;

    console.log(`[generate-image] Generating ${imageType} image with ${imageModel}, style: ${styleUsed}`);
    console.log(`[generate-image] Prompt (${finalPrompt.length} chars): ${finalPrompt.slice(0, 150)}...`);

    let result = null;
    try {
      result = await generateImageWithModel(finalPrompt, imageModel, {
        style: styleUsed,
        imageSize: 'landscape_16_9',
        aspectRatio: '16:9',
      });
    } catch (error) {
      if (error instanceof ImageGenerationError) {
        const status = error.code === 429 ? 429 : error.code === 503 ? 503 : 502;
        return NextResponse.json(
          {
            error: error.message,
            conceptId,
            provider: 'gemini-3.1-flash-image-preview',
            providerStatus: error.providerStatus,
            providerMessage: error.providerMessage,
          },
          { status }
        );
      }
      throw error;
    }

    if (result) {
      let finalUrl = result.url;

      // Get image as buffer (from data URI or fetch URL)
      let imgBuffer: Buffer | null = null;
      try {
        if (finalUrl.startsWith('data:')) {
          const b64 = finalUrl.replace(/^data:[^;]+;base64,/, '');
          imgBuffer = Buffer.from(b64, 'base64');
        } else {
          const resp = await fetch(finalUrl);
          if (resp.ok) imgBuffer = Buffer.from(await resp.arrayBuffer());
        }
      } catch (e) { console.error('[generate-image] Failed to get image buffer:', e); }

      if (imgBuffer) {
        try {
          const originalSize = imgBuffer.length;

          // Featured: resize to 1200×675 (16:9). Body: keep native aspect ratio, cap at 1024px wide.
          // Title is baked into featured images via the Gemini prompt — no Sharp text overlay needed.
          const pipeline = isFeatured
            ? sharp(imgBuffer).resize({ width: 1200, height: 675, fit: 'cover', withoutEnlargement: false })
            : sharp(imgBuffer).resize({ width: 1024, fit: 'inside', withoutEnlargement: true });

          const compressed = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
          finalUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
          console.log(`[generate-image] Processed: ${Math.round(originalSize/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
        } catch (e) { console.error('[generate-image] Processing failed, using raw:', e); }
      }

      console.log(`[generate-image] SUCCESS with ${imageModel}`);
      return NextResponse.json({
        imageUrl: finalUrl,
        conceptId,
        provider: result.provider,
        model: result.model,
        imageType,
        usedFallback: false,
        success: true,
      });
    }

    console.error('[generate-image] FAILED - returning error');
    return NextResponse.json(
      { error: "Image generation failed for an unknown reason.", conceptId, provider: 'failed' },
      { status: 500 }
    );

  } catch (error) {
    console.error("Generate image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}
