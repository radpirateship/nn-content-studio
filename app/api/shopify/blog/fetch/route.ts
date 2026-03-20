import { type NextRequest, NextResponse } from "next/server";
import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from "@/lib/shopifyAuth";

const API_VERSIONS = ["2024-10", "2024-07", "2024-04", "2024-01"];

async function shopifyAdminFetch(path: string, options: RequestInit = {}) {
  const token = await getShopifyAccessToken();

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

      if (response.ok) return response.json();

      const status = response.status;
      if (status === 404) continue;
      if (status === 401 || status === 403) {
        throw new Error(`Shopify auth failed (${status})`);
      }

      const body = await response.text();
      console.error(`[blog/fetch] v${version}: ${status} - ${body.slice(0, 200)}`);
    } catch (err) {
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) throw err;
    }
  }

  throw new Error("All Shopify API versions failed.");
}

/**
 * GET /api/shopify/blog/fetch?handle=versaclimber-benefits
 * GET /api/shopify/blog/fetch?id=12345678
 *
 * Fetches a single article from Shopify by handle or ID.
 * Returns the full article object including body_html, tags, metafields, featured_image.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");
    const articleId = searchParams.get("id");

    if (!handle && !articleId) {
      return NextResponse.json(
        { error: "Provide either ?handle= or ?id= parameter" },
        { status: 400 }
      );
    }

    // Resolve blog ID
    const blogsData = await shopifyAdminFetch("blogs.json");
    const blogs = blogsData.blogs || [];
    const blog = blogs.find(
      (b: { handle: string }) =>
        b.handle === "news" ||
        b.handle === "wellness" ||
        b.handle === "protein"
    );
    const blogId = blog?.id || blogs[0]?.id;

    if (!blogId) {
      return NextResponse.json(
        { error: "No blogs found in Shopify store." },
        { status: 400 }
      );
    }

    let article: Record<string, unknown> | null = null;

    if (articleId) {
      const data = await shopifyAdminFetch(
        `blogs/${blogId}/articles/${articleId}.json`
      );
      article = data.article || null;
    } else if (handle) {
      const data = await shopifyAdminFetch(
        `blogs/${blogId}/articles.json?handle=${encodeURIComponent(handle)}&limit=1`
      );
      const articles = data.articles || [];
      article = articles[0] || null;
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    let metafields: unknown[] = [];
    try {
      const metaData = await shopifyAdminFetch(
        `articles/${article.id}/metafields.json`
      );
      metafields = metaData.metafields || [];
    } catch {
      console.warn("[blog/fetch] Could not fetch metafields — continuing without them");
    }

    return NextResponse.json({
      id: article.id,
      title: article.title,
      handle: article.handle,
      body_html: article.body_html,
      tags: article.tags,
      summary_html: article.summary_html,
      author: article.author,
      published_at: article.published_at,
      updated_at: article.updated_at,
      created_at: article.created_at,
      image: article.image,
      metafields,
      blog_id: blogId,
    });
  } catch (error) {
    console.error("[blog/fetch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch article" },
      { status: 500 }
    );
  }
}
