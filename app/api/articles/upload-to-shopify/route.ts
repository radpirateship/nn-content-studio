import { type NextRequest, NextResponse } from "next/server";
import { uploadFalImageToShopify, uploadDataUriToShopify } from "@/lib/shopifyImageUpload";

// Each image upload can take ~4-30s for Shopify staged upload + polling
export const maxDuration = 60;

/**
 * POST /api/articles/upload-to-shopify
 *
 * Uploads a single image (data URI or fal.media URL) to Shopify Files
 * and returns a permanent cdn.shopify.com URL.
 *
 * Used by the manual image storyboard flow to upload body images
 * to Shopify Files BEFORE inserting into article HTML.
 *
 * Body: { imageUrl: string, altText?: string }
 * Response: { shopifyUrl: string, success: true }
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl, altText = "Article image" } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Already a Shopify CDN URL — nothing to do
    if (imageUrl.includes("cdn.shopify.com")) {
      return NextResponse.json({ shopifyUrl: imageUrl, success: true, alreadyUploaded: true });
    }

    let shopifyUrl: string;

    if (imageUrl.startsWith("data:")) {
      shopifyUrl = await uploadDataUriToShopify(imageUrl, altText);
    } else if (/fal\.media|fal\.run|fal-cdn|v3\.fal\.media/.test(imageUrl)) {
      shopifyUrl = await uploadFalImageToShopify(imageUrl, altText);
    } else {
      // Unknown format — try as external URL (fal uploader handles generic URLs too)
      shopifyUrl = await uploadFalImageToShopify(imageUrl, altText);
    }

    console.log(`[upload-to-shopify] Uploaded: ${shopifyUrl.slice(0, 80)}...`);

    return NextResponse.json({ shopifyUrl, success: true });
  } catch (error) {
    console.error("[upload-to-shopify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image to Shopify" },
      { status: 500 }
    );
  }
}
