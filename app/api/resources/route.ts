import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

// GET - Fetch resources (images, documents, etc.)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");

  try {
    const sql = getSQL();

    if (type === "summary") {
      // Return simple counts
      const counts = await sql`
        SELECT resource_type, COUNT(*) as count
        FROM resources
        GROUP BY resource_type
      `;
      const summary: Record<string, number> = {};
      for (const row of counts) {
        summary[row.resource_type] = Number(row.count);
      }
      return NextResponse.json(summary);
    }

    // Return empty items for collection-type queries (NN doesn't use PPW collections)
    if (type === "collections" || type === "topical-authority") {
      return NextResponse.json({ items: [], count: 0 });
    }

    // Fetch resources with optional filters
    let rows;
    if (type && category) {
      rows = await sql`SELECT * FROM resources WHERE resource_type = ${type} AND category = ${category} ORDER BY created_at DESC`;
    } else if (type) {
      rows = await sql`SELECT * FROM resources WHERE resource_type = ${type} ORDER BY created_at DESC`;
    } else if (category) {
      rows = await sql`SELECT * FROM resources WHERE category = ${category} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM resources ORDER BY created_at DESC LIMIT 100`;
    }

    return NextResponse.json({
      items: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Resource fetch error:", error);
    return NextResponse.json({
      items: [],
      count: 0,
    });
  }
}

// POST - Create a new resource
export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const body = await request.json();
    const {
      resource_type,
      title,
      description,
      url,
      alt_text,
      width,
      height,
      category,
      article_id,
      placement,
      generated,
      ai_model,
      generation_prompt,
    } = body;

    if (!resource_type || !title) {
      return NextResponse.json({ error: "resource_type and title are required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO resources (
        resource_type, title, description, url, alt_text, width, height,
        category, article_id, placement, generated, ai_model, generation_prompt
      ) VALUES (
        ${resource_type}, ${title}, ${description || null}, ${url || null},
        ${alt_text || null}, ${width || null}, ${height || null},
        ${category || null}, ${article_id || null}, ${placement || null},
        ${generated || false}, ${ai_model || null}, ${generation_prompt || null}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("Resource create error:", error);
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 });
  }
}

// DELETE - Delete a resource
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  try {
    const sql = getSQL();

    if (!id) {
      return NextResponse.json({ error: "Resource ID required" }, { status: 400 });
    }

    await sql`DELETE FROM resources WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resource delete error:", error);
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}
