import { type NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

/**
 * Workshop Reviews — CRUD for article review status tracking
 *
 * GET /api/workshop/reviews?shopifyArticleId=123
 * GET /api/workshop/reviews?ids=123,456,789
 * POST /api/workshop/reviews  — upsert review status
 */

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL();
    const { searchParams } = new URL(request.url);
    const shopifyArticleId = searchParams.get("shopifyArticleId");
    const ids = searchParams.get("ids");

    if (shopifyArticleId) {
      const parsedId = parseInt(shopifyArticleId, 10);
      if (isNaN(parsedId)) {
        return NextResponse.json(
          { error: "shopifyArticleId must be a valid number" },
          { status: 400 }
        );
      }

      const rows = await sql`
        SELECT id, shopify_article_id, handle, title, status, notes, reviewed_at, created_at
        FROM workshop_reviews
        WHERE shopify_article_id = ${parsedId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return NextResponse.json({
          status: "not_reviewed",
          shopifyArticleId: parsedId,
        });
      }

      return NextResponse.json(rows[0]);
    }

    if (ids) {
      const idList = ids
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));

      if (idList.length === 0) {
        return NextResponse.json({ reviews: [] });
      }

      const rows = await sql`
        SELECT id, shopify_article_id, handle, title, status, notes, reviewed_at, created_at
        FROM workshop_reviews
        WHERE shopify_article_id = ANY(${idList})
      `;

      const reviewMap: Record<number, unknown> = {};
      for (const row of rows) {
        reviewMap[row.shopify_article_id as number] = row;
      }

      return NextResponse.json({ reviews: reviewMap });
    }

    const rows = await sql`
      SELECT id, shopify_article_id, handle, title, status, notes, reviewed_at, created_at
      FROM workshop_reviews
      ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
      LIMIT 500
    `;

    return NextResponse.json({ reviews: rows });
  } catch (error) {
    console.error("[workshop/reviews] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const { shopifyArticleId, handle, title, status, notes } = await request.json();

    if (!shopifyArticleId || !handle || !title || !status) {
      return NextResponse.json(
        { error: "shopifyArticleId, handle, title, and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["not_reviewed", "approved", "needs_work"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const reviewedAt = status === "not_reviewed" ? null : new Date().toISOString();

    const rows = await sql`
      INSERT INTO workshop_reviews (shopify_article_id, handle, title, status, notes, reviewed_at)
      VALUES (${shopifyArticleId}, ${handle}, ${title}, ${status}, ${notes || null}, ${reviewedAt})
      ON CONFLICT (shopify_article_id)
      DO UPDATE SET
        handle = EXCLUDED.handle,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        notes = COALESCE(EXCLUDED.notes, workshop_reviews.notes),
        reviewed_at = EXCLUDED.reviewed_at
      RETURNING id, shopify_article_id, handle, title, status, notes, reviewed_at, created_at
    `;

    return NextResponse.json({ success: true, review: rows[0] });
  } catch (error) {
    console.error("[workshop/reviews] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save review" },
      { status: 500 }
    );
  }
}
