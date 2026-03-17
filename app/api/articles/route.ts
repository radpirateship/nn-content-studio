import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

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
      SELECT id, title, slug, category, keyword, status, word_count, meta_description, article_type, created_at, updated_at
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
  try {
    const sql = getSQL();
    const body = await request.json();
    const {
      title,
      slug,
      category,
      keyword,
      html_content,
      meta_description,
      schema_markup,
      featured_image_url,
      featured_image_alt,
      word_count,
      status = "draft",
      article_type,
      source_type = "new",
      original_shopify_id,
    } = body;

    // Check if slug exists and make it unique if needed
    let uniqueSlug = slug;
    const existingSlugs = await sql`
      SELECT slug FROM articles WHERE slug LIKE ${slug + '%'}
    `;

    if (existingSlugs.length > 0) {
      // Add timestamp to make slug unique
      uniqueSlug = `${slug}-${Date.now()}`;
    }

    const articles = await sql`
      INSERT INTO articles (
        title, slug, category, keyword, html_content, meta_description,
        schema_markup, featured_image_url, featured_image_alt, word_count, status, article_type,
        source_type, original_shopify_id
      ) VALUES (
        ${title}, ${uniqueSlug}, ${category}, ${keyword}, ${html_content}, ${meta_description},
        ${schema_markup || null}, ${featured_image_url || null}, ${featured_image_alt || null},
        ${word_count || 0}, ${status}, ${article_type || null},
        ${source_type}, ${original_shopify_id || null}
      )
      RETURNING *
    `;

    return NextResponse.json(articles[0], { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing article
export async function PUT(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Article ID required" }, { status: 400 });
    }

    // Build dynamic update query
    const allowedFields = [
      "title", "slug", "category", "keyword", "html_content", "meta_description",
      "schema_markup", "featured_image_url", "featured_image_alt", "word_count", "status"
    ];

    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(field);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Use parameterized query for safety
    const articles = await sql`
      UPDATE articles 
      SET 
        title = COALESCE(${updates.title}, title),
        slug = COALESCE(${updates.slug}, slug),
        category = COALESCE(${updates.category}, category),
        keyword = COALESCE(${updates.keyword}, keyword),
        html_content = COALESCE(${updates.html_content}, html_content),
        meta_description = COALESCE(${updates.meta_description}, meta_description),
        schema_markup = COALESCE(${updates.schema_markup}, schema_markup),
        featured_image_url = CASE WHEN ${'featured_image_url' in updates}::boolean THEN ${updates.featured_image_url ?? null} ELSE featured_image_url END,
        featured_image_alt = CASE WHEN ${'featured_image_alt' in updates}::boolean THEN ${updates.featured_image_alt ?? null} ELSE featured_image_alt END,
        word_count = COALESCE(${updates.word_count}, word_count),
        status = COALESCE(${updates.status}, status),
          article_type = COALESCE(${updates.article_type}, article_type),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (articles.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(articles[0]);
  } catch (error) {
    console.error("Error updating article:", error);
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
