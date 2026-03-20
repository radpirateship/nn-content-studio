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
      console.error(`[blog/search] v${version}: ${status} - ${body.slice(0, 200)}`);
    } catch (err) {
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) throw err;
    }
  }

  throw new Error("All Shopify API versions failed.");
}

/**
 * GET /api/shopify/blog/search?q=whey+protein
 * GET /api/shopify/blog/search?tag=Protein+Powder
 * GET /api/shopify/blog/search?tag=Protein+Powder&limit=50
 *
 * Searches articles by title keyword or tag across the blog.
 * Returns lean payload — no body_html — for fast search results.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const tag = searchParams.get("tag");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 250);

    if (!query && !tag) {
      return NextResponse.json(
        { error: "Provide a search query (?q=) or tag filter (?tag=)" },
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

    let articles: {
      id: number;
      title: string;
      handle: string;
      tags: string;
      published_at: string;
      updated_at: string;
      image?: { src: string; alt: string };
      body_html?: string;
    }[] = [];

    if (tag) {
      let sinceId = 0;
      let hasMore = true;
      const batchSize = 250;

      while (hasMore && articles.length < limit) {
        const params = new URLSearchParams({
          limit: String(batchSize),
          fields: "id,title,handle,tags,published_at,updated_at,image,body_html",
          ...(sinceId ? { since_id: String(sinceId) } : {}),
        });

        const data = await shopifyAdminFetch(
          `blogs/${blogId}/articles.json?${params.toString()}`
        );
        const batch = data.articles || [];

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        const tagLower = tag.toLowerCase();
        const matching = batch.filter((a: { tags: string }) =>
          (a.tags || "")
            .split(",")
            .map((t: string) => t.trim().toLowerCase())
            .includes(tagLower)
        );

        articles.push(...matching);
        sinceId = batch[batch.length - 1].id;

        if (batch.length < batchSize) hasMore = false;
      }
    } else if (query) {
      let sinceId = 0;
      let hasMore = true;
      const batchSize = 250;
      const queryLower = query.toLowerCase();

      while (hasMore && articles.length < limit) {
        const params = new URLSearchParams({
          limit: String(batchSize),
          fields: "id,title,handle,tags,published_at,updated_at,image,body_html",
          ...(sinceId ? { since_id: String(sinceId) } : {}),
        });

        const data = await shopifyAdminFetch(
          `blogs/${blogId}/articles.json?${params.toString()}`
        );
        const batch = data.articles || [];

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        const matching = batch.filter(
          (a: { title: string; handle: string }) =>
            a.title.toLowerCase().includes(queryLower) ||
            a.handle.toLowerCase().includes(queryLower)
        );

        articles.push(...matching);
        sinceId = batch[batch.length - 1].id;

        if (batch.length < batchSize) hasMore = false;
      }
    }

    const results = articles.slice(0, limit).map((a) => {
      const body = a.body_html || "";
      return {
        id: a.id,
        title: a.title,
        handle: a.handle,
        tags: a.tags,
        published_at: a.published_at,
        updated_at: a.updated_at,
        has_image: !!a.image?.src,
        has_content_images: /<img/i.test(body),
        has_internal_links: /href="\/blogs\/wellness\//i.test(body),
        has_products: /nn-card|nn-product/i.test(body),
        has_faq: /<details|nn-faq/i.test(body),
      };
    });

    return NextResponse.json({ articles: results, blog_id: blogId });
  } catch (error) {
    console.error("[blog/search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search articles" },
      { status: 500 }
    );
  }
}
