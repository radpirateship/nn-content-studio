import { type NextRequest, NextResponse } from "next/server";
import { replaceWithShopifyImages } from "@/lib/shopifyImageUpload";
import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from "@/lib/shopifyAuth";

// Allow enough time for Shopify staged uploads + polling (each image ~4-30s)
export const maxDuration = 300;

const API_VERSIONS = ["2024-10", "2024-07", "2024-04", "2024-01"];

async function shopifyAdminFetch(path: string, options: RequestInit = {}) {
  const token = await getShopifyAccessToken();

  for (const version of API_VERSIONS) {
    const url = `https://${SHOPIFY_ADMIN_DOMAIN}/admin/api/${version}/${path}`;
    try {
      console.log(`[shopify] Trying API ${version}: ${path}`);
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
          ...options.headers,
        },
      });

      if (response.ok) {
        console.log(`[shopify] SUCCESS on API ${version}`);
        return response.json();
      }

      const status = response.status;
      if (status === 404) continue; // version doesn't exist, try next
      if (status === 401 || status === 403) {
        throw new Error(`Shopify auth failed (${status}) - token may be expired or missing scopes`);
      }

      const body = await response.text();
      console.error(`[shopify] v${version}: ${status} - ${body}`);
    } catch (err) {
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) throw err;
    }
  }

  throw new Error("All Shopify API versions failed. Check your app scopes and credentials.");
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
  try {
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
    } = await request.json();

    if (!title || !bodyHtml) {
      return NextResponse.json(
        { error: "Title and bodyHtml are required" },
        { status: 400 }
      );
    }

    // If no blogId provided, resolve the right NN blog based on article category
    let targetBlogId = blogId;
    if (!targetBlogId) {
      const blogsData = await shopifyAdminFetch("blogs.json");
      const blogs: { id: number; handle: string }[] = blogsData.blogs || [];

      const CATEGORY_TO_BLOG: Record<string, string> = {
        'protein-powder': 'protein', 'whey-protein': 'protein', 'vegan-protein-powder': 'protein',
        'collagen-peptides': 'wellness', 'collagen': 'wellness', 'kids': 'wellness',
        'overnight-oats': 'recipes',
        'improve-performance-recovery': 'fitness', 'post-workout': 'fitness',
        'supplements': 'supplements', 'creatine': 'supplements', 'pre-workout': 'supplements',
        'bcaa': 'supplements', 'greens': 'supplements', 'vitamins': 'supplements',
        'probiotics': 'supplements', 'energy': 'supplements',
        'weight-management': 'diets', 'keto': 'diets',
        'vegan': 'protein',
      }
      const preferredHandle = CATEGORY_TO_BLOG[category] || 'news'
      const preferredBlog = blogs.find((b) => b.handle === preferredHandle)
      const fallback = blogs.find((b) => b.handle === 'news') || blogs[0]
      targetBlogId = preferredBlog?.id || fallback?.id;

      if (!targetBlogId) {
        return NextResponse.json(
          { error: "No blogs found in Shopify store. Please create a blog first." },
          { status: 400 }
        );
      }
    }

    // Upload external fal.media images AND base64 data URIs to Shopify Files
    console.log("[shopify] Processing images for Shopify upload...");
    const processedBodyHtml = await replaceWithShopifyImages(bodyHtml);

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

    if (featuredImageUrl) {
      articlePayload.image = {
        src: featuredImageUrl,
        alt: featuredImageAlt || title,
      };
    }

    if (metafields && metafields.length > 0) {
      articlePayload.metafields = metafields;
    }

    const data = await shopifyAdminFetch(`blogs/${targetBlogId}/articles.json`, {
      method: "POST",
      body: JSON.stringify({ article: articlePayload }),
    });

    const createdArticle = data.article;

    return NextResponse.json({
      success: true,
      article: {
        id: createdArticle.id,
        title: createdArticle.title,
        handle: createdArticle.handle,
        url: `https://nakednutrition.com/blogs/wellness/${createdArticle.handle}`,
        published_at: createdArticle.published_at,
        created_at: createdArticle.created_at,
      },
      blogId: targetBlogId,
    });
  } catch (error) {
    console.error("Failed to publish article:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish article to Shopify" },
      { status: 500 }
    );
  }
}
