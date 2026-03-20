import { type NextRequest, NextResponse } from "next/server";
import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from "@/lib/shopifyAuth";
import { getSQL } from "@/lib/db";

export const maxDuration = 60;

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

      if (response.ok) return response.json();

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

/**
 * PUT /api/shopify/blog/update
 *
 * Updates an existing Shopify article in place (does NOT create a duplicate).
 * After successful Shopify PUT, syncs the article to the Content Studio DB.
 */
export async function PUT(request: NextRequest) {
  try {
    const { shopifyArticleId, blogId, fields } = await request.json();

    if (!shopifyArticleId) {
      return NextResponse.json(
        { error: "shopifyArticleId is required" },
        { status: 400 }
      );
    }

    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "fields object is required with at least one field to update" },
        { status: 400 }
      );
    }

    let targetBlogId = blogId;
    let resolvedBlogHandle = 'news';
    if (!targetBlogId) {
      const blogsData = await shopifyAdminFetch("blogs.json");
      const blogs = blogsData.blogs || [];
      const blog = blogs.find(
        (b: { handle: string }) =>
          b.handle === "news" ||
          b.handle === "wellness" ||
          b.handle === "protein"
      );
      targetBlogId = blog?.id || blogs[0]?.id;
      resolvedBlogHandle = blog?.handle || blogs[0]?.handle || 'news';

      if (!targetBlogId) {
        return NextResponse.json(
          { error: "No blogs found in Shopify store." },
          { status: 400 }
        );
      }
    }

    const articlePayload: Record<string, unknown> = {};
    if (fields.body_html !== undefined) articlePayload.body_html = fields.body_html;
    if (fields.tags !== undefined) articlePayload.tags = fields.tags;
    if (fields.summary_html !== undefined) articlePayload.summary_html = fields.summary_html;
    if (fields.title !== undefined) articlePayload.title = fields.title;
    if (fields.image) {
      articlePayload.image = {
        src: fields.image.src,
        alt: fields.image.alt || fields.title || "Article image",
      };
    }

    console.log(`[blog/update] Updating article ${shopifyArticleId} on blog ${targetBlogId}...`);
    const data = await shopifyAdminFetch(
      `blogs/${targetBlogId}/articles/${shopifyArticleId}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ article: articlePayload }),
      }
    );

    const updatedArticle = data.article;
    console.log(`[blog/update] Article ${shopifyArticleId} updated successfully`);

    let dbSynced = false;
    try {
      const sql = getSQL();
      const existing = await sql`
        SELECT id FROM articles WHERE slug = ${updatedArticle.handle} LIMIT 1
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE articles
          SET html_content = ${updatedArticle.body_html || ""},
              meta_description = ${updatedArticle.summary_html || ""},
              updated_at = NOW()
          WHERE slug = ${updatedArticle.handle}
        `;
      } else {
        const wordCount = (updatedArticle.body_html || "")
          .replace(/<[^>]*>/g, " ")
          .split(/\s+/)
          .filter(Boolean).length;

        const tags = (updatedArticle.tags || "").toLowerCase();
        let category = "general-nutrition";
        const categoryMap: [string, string][] = [
          ["whey protein", "whey-protein"],
          ["whey", "whey-protein"],
          ["vegan protein", "vegan-protein-powder"],
          ["plant protein", "vegan-protein-powder"],
          ["collagen", "collagen-peptides"],
          ["protein powder", "protein-powder"],
          ["protein", "protein-powder"],
          ["overnight oats", "overnight-oats"],
          ["performance", "improve-performance-recovery"],
          ["recovery", "improve-performance-recovery"],
          ["pre-workout", "supplements"],
          ["creatine", "supplements"],
          ["bcaa", "supplements"],
          ["supplements", "supplements"],
          ["kids", "kids"],
        ];
        for (const [keyword, cat] of categoryMap) {
          if (tags.includes(keyword)) {
            category = cat;
            break;
          }
        }

        await sql`
          INSERT INTO articles (title, slug, category, keyword, html_content, meta_description, word_count, status, created_at, updated_at)
          VALUES (
            ${updatedArticle.title},
            ${updatedArticle.handle},
            ${category},
            ${updatedArticle.title},
            ${updatedArticle.body_html || ""},
            ${updatedArticle.summary_html || ""},
            ${wordCount},
            'published',
            NOW(),
            NOW()
          )
        `;
      }
      dbSynced = true;
    } catch (dbError) {
      console.error("[blog/update] DB sync failed (article still updated on Shopify):", dbError);
    }

    return NextResponse.json({
      success: true,
      article: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        handle: updatedArticle.handle,
        url: `https://nakednutrition.com/blogs/${resolvedBlogHandle}/${updatedArticle.handle}`,
        updated_at: updatedArticle.updated_at,
      },
      blogId: targetBlogId,
      dbSynced,
    });
  } catch (error) {
    console.error("[blog/update] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update article on Shopify" },
      { status: 500 }
    );
  }
}
