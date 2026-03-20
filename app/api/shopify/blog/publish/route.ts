import { type NextRequest, NextResponse } from "next/server";
import { replaceWithShopifyImages } from "@/lib/shopifyImageUpload";
import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from "@/lib/shopifyAuth";
import { logActivity } from "@/lib/activity-log";
import { shopifyPublishRequestSchema } from "@/lib/api-schemas";
import { getErrorMessage, logRouteEvent, parseAndValidateJson } from "@/lib/api-utils";

// Allow enough time for Shopify staged uploads + polling (each image ~4-30s)
export const maxDuration = 120;

const API_VERSIONS = ["2024-10", "2024-07", "2024-04", "2024-01"];

async function shopifyAdminFetch(path: string, options: RequestInit = {}) {
  const token = await getShopifyAccessToken();
  const errors: string[] = [];

  for (const version of API_VERSIONS) {
    const url = `https://${SHOPIFY_ADMIN_DOMAIN}/admin/api/${version}/${path}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
          ...options.headers,
        },
      });

      if (response.ok) {
        return response.json();
      }

      const status = response.status;
      const body = await response.text();
      errors.push(`v${version}: ${status} - ${body.slice(0, 200)}`);
      
      if (status === 401 || status === 403) {
        throw new Error(`Shopify auth failed (${status}): ${body.slice(0, 200)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!errors.includes(msg)) errors.push(msg);
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) {
        throw new Error(`All API versions failed. Errors: ${errors.join(" | ")}`);
      }
    }
  }

  throw new Error(`All Shopify API versions failed. Errors: ${errors.join(" | ")}`);
}

// GET: List blogs to find the correct blog ID
export async function GET() {
  try {
    const data = await shopifyAdminFetch("blogs.json");
    return NextResponse.json({ blogs: data.blogs || [] });
  } catch (error) {
    console.error("Failed to list blogs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list blogs" },
      { status: 500 }
    );
  }
}

// POST: Publish an article to a Shopify blog
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const parsed = await parseAndValidateJson(request, shopifyPublishRequestSchema);
    if (!parsed.success) {
      logRouteEvent("Shopify publish validation failed", {
        category: "publish",
        status: "warning",
        detail: "Invalid request body",
      });
      return parsed.response;
    }

    const {
      title,
      bodyHtml,
      summary,
      tags,
      author,
      handle,
      metafields,
      blogId,
      published,
      featuredImageUrl,
      featuredImageAlt,
      category,
    } = parsed.data;

    logRouteEvent("Shopify publish request received", {
      category: "publish",
      detail: title,
      metadata: {
        category,
        published: published !== false,
        hasFeaturedImage: Boolean(featuredImageUrl),
        blogId: blogId ?? null,
        metafieldCount: metafields?.length || 0,
      },
    });

    // If no blogId provided, resolve the right NN blog based on article category
    let targetBlogId = blogId;
    let resolvedBlogHandle = 'news'; // default blog handle for URL building
    if (!targetBlogId) {
      const blogsData = await shopifyAdminFetch("blogs.json");
      const blogs: { id: number; handle: string }[] = blogsData.blogs || [];

      // Map article category → preferred NN blog handle
      const CATEGORY_TO_BLOG: Record<string, string> = {
        'protein-powder': 'protein',
        'whey-protein': 'protein',
        'vegan-protein-powder': 'protein',
        'collagen-peptides': 'wellness',
        'overnight-oats': 'recipes',
        'improve-performance-recovery': 'fitness',
        'supplements': 'supplements',
        'kids': 'wellness',
        // NNCategory fallbacks
        'creatine': 'supplements',
        'pre-workout': 'supplements',
        'post-workout': 'fitness',
        'bcaa': 'supplements',
        'greens': 'supplements',
        'vitamins': 'supplements',
        'probiotics': 'supplements',
        'energy': 'supplements',
        'weight-management': 'diets',
        'keto': 'diets',
        'vegan': 'protein',
        'collagen': 'wellness',
      }
      const preferredHandle = category ? CATEGORY_TO_BLOG[category] || 'news' : 'news'
      const preferredBlog = blogs.find((b) => b.handle === preferredHandle)
      const fallback = blogs.find((b) => b.handle === 'news') || blogs[0]
      targetBlogId = preferredBlog?.id || fallback?.id
      resolvedBlogHandle = preferredBlog ? preferredHandle : (fallback?.handle || 'news')

      if (!targetBlogId) {
        return NextResponse.json(
          { error: "No blogs found in Shopify store. Please create a blog first." },
          { status: 400 }
        );
      }
    }

    // Check if body HTML still contains temp images (data URIs or fal.media URLs).
    // If all images already use permanent cdn.shopify.com URLs (uploaded at generation time),
    // we can skip the expensive replaceWithShopifyImages() call entirely.
    const hasTempImages = /data:image\/|fal\.media|fal\.run|fal-cdn|v3\.fal\.media/.test(bodyHtml);
    let processedBodyHtml: string;
    if (hasTempImages) {
      console.warn("[shopify-publish] Found temp images in body HTML — running safety-net upload...");
      processedBodyHtml = await replaceWithShopifyImages(bodyHtml);
    } else {
      console.log("[shopify-publish] All body images already use permanent URLs — skipping re-upload.");
      processedBodyHtml = bodyHtml;
    }

    // Determine featured image: use explicit URL passed via featuredImageUrl
    let rawFeaturedUrl = featuredImageUrl;
    let rawFeaturedAlt = featuredImageAlt || title;

    // Featured image should be passed explicitly via featuredImageUrl — do NOT auto-extract from body HTML

    // Upload featured image to Shopify Files if it's a data URI or temp URL
    let shopifyFeaturedImageUrl = rawFeaturedUrl;
    if (rawFeaturedUrl) {
      try {
        if (rawFeaturedUrl.startsWith("data:")) {
          const { uploadDataUriToShopify } = await import("@/lib/shopifyImageUpload");
          shopifyFeaturedImageUrl = await uploadDataUriToShopify(rawFeaturedUrl, rawFeaturedAlt);
          console.log(`[shopify-publish] Featured image (data URI) uploaded: ${shopifyFeaturedImageUrl.slice(0, 80)}...`);
        } else if (rawFeaturedUrl.match(/fal\.media|fal\.run|fal-cdn/)) {
          const { uploadFalImageToShopify } = await import("@/lib/shopifyImageUpload");
          shopifyFeaturedImageUrl = await uploadFalImageToShopify(rawFeaturedUrl, rawFeaturedAlt);
          console.log(`[shopify-publish] Featured image (fal) uploaded: ${shopifyFeaturedImageUrl.slice(0, 80)}...`);
        }
        // If it's already a cdn.shopify.com URL (from body processing), use as-is
      } catch (err) {
        console.error("[shopify-publish] Featured image upload failed, using original URL:", err);
      }
    }

    // Build the article payload
    const articlePayload: Record<string, unknown> = {
      title,
      body_html: processedBodyHtml,
      published: published !== false,
    };

    if (summary) articlePayload.summary_html = summary;
    if (tags) articlePayload.tags = tags;
    if (author) articlePayload.author = author;
    if (handle) articlePayload.handle = handle;

    if (shopifyFeaturedImageUrl) {
      articlePayload.image = {
        src: shopifyFeaturedImageUrl,
        alt: rawFeaturedAlt,
      };
    }

    if (metafields && metafields.length > 0) {
      // Sanitize metafield values -- Shopify single_line_text_field rejects newlines
      articlePayload.metafields = metafields.map(
        (mf: { namespace: string; key: string; value: string; type: string }) => ({
          ...mf,
          value: mf.type === "single_line_text_field"
            ? (mf.value || "").replace(/[\r\n]+/g, " ").trim()
            : mf.value,
        })
      );
    }

    const data = await shopifyAdminFetch(`blogs/${targetBlogId}/articles.json`, {
      method: "POST",
      body: JSON.stringify({ article: articlePayload }),
    });

    const createdArticle = data.article;
    if (!createdArticle || !createdArticle.id) {
      const errDetail = data.errors ? JSON.stringify(data.errors) : 'No article returned';
      return NextResponse.json(
        { error: `Shopify publish failed: ${errDetail}` },
        { status: 502 }
      );
    }
    const articleUrl = `https://nakednutrition.com/blogs/${resolvedBlogHandle}/${createdArticle.handle}`;

    // Ping search engines to re-crawl the sitemap
    const sitemapUrl = "https://nakednutrition.com/sitemap.xml";
    const pingResults: Record<string, string> = {};
    const pingUrls = [
      { name: "Google", url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
      { name: "Bing", url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
      { name: "IndexNow", url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(articleUrl)}&key=nakednutrition` },
    ];
    for (const ping of pingUrls) {
      try {
        const res = await fetch(ping.url, { method: "GET" });
        pingResults[ping.name] = res.ok ? "sent" : `${res.status}`;
        console.log(`[shopify-publish] Sitemap ping ${ping.name}: ${res.ok ? "OK" : res.status}`);
      } catch {
        pingResults[ping.name] = "failed";
      }
    }

    logActivity("Published to Shopify", {
      category: "publish",
      detail: title,
      durationMs: Date.now() - startedAt,
      metadata: { handle: createdArticle.handle },
    });

    logRouteEvent("Shopify publish succeeded", {
      category: "publish",
      detail: title,
      durationMs: Date.now() - startedAt,
      metadata: {
        handle: createdArticle.handle,
        blogId: targetBlogId,
        blogHandle: resolvedBlogHandle,
      },
    });

    return NextResponse.json({
      success: true,
      article: {
        id: createdArticle.id,
        title: createdArticle.title,
        handle: createdArticle.handle,
        url: articleUrl,
        published_at: createdArticle.published_at,
        created_at: createdArticle.created_at,
      },
      blogId: targetBlogId,
      blogHandle: resolvedBlogHandle,
      sitemapPing: pingResults,
    });
  } catch (error) {
    console.error("Failed to publish article:", error);
    logRouteEvent("Shopify publish failed", {
      category: "publish",
      status: "error",
      detail: "Publish failed",
      durationMs: Date.now() - startedAt,
      metadata: { error: getErrorMessage(error, "Failed to publish article to Shopify") },
    });
    logActivity("Shopify publish failed", {
      category: "publish",
      status: "error",
      detail: "Publish failed",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish article to Shopify" },
      { status: 500 }
    );
  }
}
