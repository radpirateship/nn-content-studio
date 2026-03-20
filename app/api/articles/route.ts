import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { createArticleSchema, updateArticleSchema } from "@/lib/api-schemas";
import { getErrorMessage, logRouteEvent, parseAndValidateJson } from "@/lib/api-utils";

// GET - Fetch all articles or a specific article
export async function GET(request: NextRequest) {
  try {
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const articles = await sql`
        SELECT * FROM articles WHERE id = ${id}
      `;
      if (articles.length === 0) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
      return NextResponse.json(articles[0]);
    }

    const articles = await sql`
      SELECT id, title, slug, category, keyword, status, word_count, meta_description, created_at, updated_at
      FROM articles
      ORDER BY created_at DESC
    `;
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

// POST - Create a new article
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const parsed = await parseAndValidateJson(request, createArticleSchema);
    if (!parsed.success) {
      logRouteEvent("Article create validation failed", {
        category: "articles",
        status: "warning",
        detail: "Invalid request body",
      });
      return parsed.response;
    }

    const sql = getSQL();
    const {
      title,
      slug,
      category,
      keyword,
      html_content,
      meta_description,
      schema_markup,
      featured_image_url,
      word_count,
      status = "draft",
      tone,
      article_type,
      shopify_blog_tag,
    } = parsed.data;

    logRouteEvent("Article create request received", {
      category: "articles",
      detail: title,
      metadata: { slug, category, hasKeyword: Boolean(keyword) },
    });

    // Check if slug exists and make it unique if needed
    let uniqueSlug = slug;
    const existingSlugs = await sql`
      SELECT slug FROM articles WHERE slug LIKE ${slug + '%'}
    `;

    if (existingSlugs.length > 0) {
      uniqueSlug = `${slug}-${Date.now()}`;
    }

    const articles = await sql`
      INSERT INTO articles (
        title, slug, category, keyword, html_content, meta_description,
        schema_markup, featured_image_url, word_count, status, tone,
        article_type, shopify_blog_tag
      ) VALUES (
        ${title}, ${uniqueSlug}, ${category || null}, ${keyword || null}, ${html_content}, ${meta_description || null},
        ${schema_markup || null}, ${featured_image_url || null},
        ${word_count || 0}, ${status}, ${tone || null},
        ${article_type || null}, ${shopify_blog_tag || null}
      )
      RETURNING *
    `;

    logActivity("Article saved", {
      category: "articles",
      detail: title,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(articles[0], { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    logRouteEvent("Article create failed", {
      category: "articles",
      status: "error",
      detail: "Failed to create article",
      durationMs: Date.now() - startedAt,
      metadata: { error: getErrorMessage(error, "Failed to create article") },
    });
    logActivity("Article save failed", {
      category: "articles",
      status: "error",
      detail: "Unknown article",
    });
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing article
export async function PUT(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const parsed = await parseAndValidateJson(request, updateArticleSchema);
    if (!parsed.success) {
      logRouteEvent("Article update validation failed", {
        category: "articles",
        status: "warning",
        detail: "Invalid request body",
      });
      return parsed.response;
    }

    const sql = getSQL();
    const { id, ...updates } = parsed.data;

    logRouteEvent("Article update request received", {
      category: "articles",
      detail: `id:${id}`,
      metadata: { fields: Object.keys(updates).filter((key) => updates[key as keyof typeof updates] !== undefined) },
    });

    // Build dynamic update query
    // Use parameterized query for safety
    const articles = await sql`
      UPDATE articles
      SET
        title = COALESCE(${updates.title ?? null}, title),
        slug = COALESCE(${updates.slug ?? null}, slug),
        category = COALESCE(${updates.category ?? null}, category),
        keyword = COALESCE(${updates.keyword ?? null}, keyword),
        html_content = COALESCE(${updates.html_content ?? null}, html_content),
        meta_description = COALESCE(${updates.meta_description ?? null}, meta_description),
        schema_markup = COALESCE(${updates.schema_markup ?? null}, schema_markup),
        featured_image_url = COALESCE(${updates.featured_image_url ?? null}, featured_image_url),
        word_count = COALESCE(${updates.word_count ?? null}, word_count),
        status = COALESCE(${updates.status ?? null}, status),
        tone = COALESCE(${updates.tone ?? null}, tone),
        article_type = COALESCE(${updates.article_type ?? null}, article_type),
        shopify_blog_tag = COALESCE(${updates.shopify_blog_tag ?? null}, shopify_blog_tag),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (articles.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    logRouteEvent("Article updated", {
      category: "articles",
      detail: `id:${id}`,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(articles[0]);
  } catch (error) {
    console.error("Error updating article:", error);
    logRouteEvent("Article update failed", {
      category: "articles",
      status: "error",
      detail: "Failed to update article",
      durationMs: Date.now() - startedAt,
      metadata: { error: getErrorMessage(error, "Failed to update article") },
    });
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an article
export async function DELETE(request: NextRequest) {
  try {
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Article ID required" }, { status: 400 });
    }

    await sql`DELETE FROM articles WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}
