import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

interface TopicalAuthority {
  id: string;
  type: string;
  title: string;
  primaryKeyword: string;
  intent: string;
  format: string;
  wordCount: number;
  priority: string;
  action: string;
  existingUrl: string;
  optimize: boolean;
  notes: string;
  searchVolume: string;
  titleTag: string;
  metaDescription: string;
  collectionSlug?: string;
}

interface Collection {
  id: string;
  url: string;
  category: string;
  primaryKeyword: string;
  searchVolume: string;
  keywordDifficulty: string;
  secondaryKeywords: string[];
  optimizedTitleTag: string;
  optimizedMetaDescription: string;
  currentPosition: string;
  currentImpressions: string;
  priority: string;
  estimatedImpact: string;
  optimizedEC: boolean;
  collectionSlug?: string;
}

// Parse CSV content
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const separator = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseCSVLine(lines[0], separator);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], separator);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((val) => val.replace(/^"|"$/g, "").trim());
}

// Normalize URLs: ensure they have https:// protocol
function normalizeUrl(url: string): string {
  if (!url || url.trim() === "") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

// Parse Topical Authority data
function parseTopicalAuthority(
  rows: Record<string, string>[]
): TopicalAuthority[] {
  return rows
    .map((row, index) => {
      const title = row["Title"] || "";
      if (!title) return null;

      const wordCountStr = row["Word Count"] || row["WordCount"] || "2000";
      const wordCount = parseInt(wordCountStr.replace(/,/g, ""), 10) || 2000;

      const optimizeStr = (row["optimize"] || row["Optimize"] || "").toLowerCase();
      const optimize = optimizeStr === "yes" || optimizeStr === "true" || optimizeStr === "1";

      return {
        id: `ta-${index}`,
        type: row["Type"] || "",
        title: title,
        primaryKeyword: row["Primary Keyword"] || row["PrimaryKeyword"] || "",
        intent: row["Intent"] || "",
        format: row["Format"] || "",
        wordCount: wordCount,
        priority: row["Priority"] || "",
        action: row["Action"] || "",
        existingUrl: normalizeUrl(row["Existing URL"] || row["ExistingURL"] || row["URL"] || ""),
        optimize: optimize,
        notes: row["Notes"] || "",
        searchVolume: row["KW Search Volume"] || row["Search Volume"] || "",
        titleTag: row["Title Tag"] || row["TitleTag"] || "",
        metaDescription: row["Meta Description"] || row["MetaDescription"] || "",
      };
    })
    .filter(Boolean) as TopicalAuthority[];
}

// Parse Collections data
function parseCollections(rows: Record<string, string>[]): Collection[] {
  return rows
    .map((row, index) => {
      const url = normalizeUrl(row["Collection URL"] || row["URL"] || "");
      const category = row["Category"] || "";
      
      if (!url && !category) return null;

      const secondaryKeywords: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const kw = row[`Secondary Keyword ${i}`] || row[`SecondaryKeyword${i}`] || "";
        if (kw) secondaryKeywords.push(kw);
      }

      const optimizedECStr = (row["Optimized EC?"] || row["Optimized EC"] || "").toLowerCase();
      const optimizedEC = optimizedECStr === "yes" || optimizedECStr === "true" || optimizedECStr === "1";

      return {
        id: `col-${index}`,
        url: url,
        category: category,
        primaryKeyword: row["Primary Keyword"] || row["PrimaryKeyword"] || "",
        searchVolume: row["Search Volume"] || "",
        keywordDifficulty: row["KD"] || row["Keyword Difficulty"] || "",
        secondaryKeywords: secondaryKeywords.filter(Boolean),
        optimizedTitleTag: row["Optimized Title Tag"] || row["Title Tag"] || "",
        optimizedMetaDescription: row["Optimized Meta Description"] || row["Meta Description"] || "",
        currentPosition: row["Current Position"] || "",
        currentImpressions: row["Current Impressions"] || "",
        priority: row["Priority"] || "",
        estimatedImpact: row["Estimated Impact"] || "",
        optimizedEC: optimizedEC,
      };
    })
    .filter(Boolean) as Collection[];
}

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const collectionSlug = formData.get("collection_slug") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || !["topical-authority", "collections"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid resource type" },
        { status: 400 }
      );
    }

    const content = await file.text();
    const rows = parseCSV(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data found in file" },
        { status: 400 }
      );
    }

    if (type === "topical-authority") {
      const items = parseTopicalAuthority(rows);
      
      // SCOPED DELETE: only clear items for this collection (or unscoped if no slug)
      if (collectionSlug) {
        await sql`DELETE FROM topical_authority WHERE collection_slug = ${collectionSlug}`;
      } else {
        await sql`DELETE FROM topical_authority WHERE collection_slug IS NULL`;
      }
      
      for (const item of items) {
        await sql`
          INSERT INTO topical_authority (
            type, title, primary_keyword, intent, format, word_count,
            priority, action, existing_url, optimize, notes,
            search_volume, title_tag, meta_description, collection_slug
          ) VALUES (
            ${item.type}, ${item.title}, ${item.primaryKeyword}, ${item.intent},
            ${item.format}, ${item.wordCount}, ${item.priority}, ${item.action},
            ${item.existingUrl}, ${item.optimize}, ${item.notes},
            ${item.searchVolume}, ${item.titleTag}, ${item.metaDescription},
            ${collectionSlug || null}
          )
        `;
      }
      
      return NextResponse.json({
        success: true,
        count: items.length,
        items: items,
        collectionSlug: collectionSlug || null,
        persisted: true,
      });
    } else {
      const items = parseCollections(rows);
      
      // SCOPED DELETE: only clear items for this collection (or unscoped if no slug)
      if (collectionSlug) {
        await sql`DELETE FROM collections WHERE collection_slug = ${collectionSlug}`;
      } else {
        await sql`DELETE FROM collections WHERE collection_slug IS NULL`;
      }
      
      for (const item of items) {
        await sql`
          INSERT INTO collections (
            url, category, primary_keyword, search_volume, keyword_difficulty,
            secondary_keywords, optimized_title_tag, optimized_meta_description,
            current_position, current_impressions, priority, estimated_impact,
            optimized_ec, collection_slug
          ) VALUES (
            ${item.url}, ${item.category}, ${item.primaryKeyword}, ${item.searchVolume},
            ${item.keywordDifficulty}, ${item.secondaryKeywords}, ${item.optimizedTitleTag},
            ${item.optimizedMetaDescription}, ${item.currentPosition}, ${item.currentImpressions},
            ${item.priority}, ${item.estimatedImpact}, ${item.optimizedEC},
            ${collectionSlug || null}
          )
        `;
      }
      
      return NextResponse.json({
        success: true,
        count: items.length,
        items: items,
        collectionSlug: collectionSlug || null,
        persisted: true,
      });
    }
  } catch (error) {
    console.error("Resource upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const collection = searchParams.get("collection");

  try {
    const sql = getSQL();

    // SUMMARY endpoint: returns counts grouped by collection_slug
    if (type === "summary") {
      const taCounts = await sql`
        SELECT collection_slug, COUNT(*) as count 
        FROM topical_authority 
        GROUP BY collection_slug
      `;
      const colCounts = await sql`
        SELECT collection_slug, COUNT(*) as count 
        FROM collections 
        GROUP BY collection_slug
      `;
      const prodCounts = await sql`
        SELECT collection_slug, COUNT(*) as count 
        FROM products 
        GROUP BY collection_slug
      `;

      const summary: Record<string, { topicalAuthority: number; collections: number; products: number }> = {};

      const knownSlugs = [
        "sensory-deprivation-tanks", "saunas", "cold-plunge", "red-light-therapy",
        "hyperbaric-chambers", "massage-equipment", "recovery-tools",
        "general-wellness", "steam"
      ];
      for (const slug of knownSlugs) {
        summary[slug] = { topicalAuthority: 0, collections: 0, products: 0 };
      }

      for (const row of taCounts) {
        const slug = row.collection_slug || "unscoped";
        if (!summary[slug]) summary[slug] = { topicalAuthority: 0, collections: 0, products: 0 };
        summary[slug].topicalAuthority = Number(row.count);
      }
      for (const row of colCounts) {
        const slug = row.collection_slug || "unscoped";
        if (!summary[slug]) summary[slug] = { topicalAuthority: 0, collections: 0, products: 0 };
        summary[slug].collections = Number(row.count);
      }
      for (const row of prodCounts) {
        const slug = row.collection_slug || "unscoped";
        if (!summary[slug]) summary[slug] = { topicalAuthority: 0, collections: 0, products: 0 };
        summary[slug].products = Number(row.count);
      }

      return NextResponse.json(summary);
    }

    if (type === "topical-authority") {
      const rows = collection
        ? await sql`SELECT * FROM topical_authority WHERE collection_slug = ${collection} ORDER BY id`
        : await sql`SELECT * FROM topical_authority ORDER BY id`;

      const items = rows.map((row) => ({
        id: `ta-${row.id}`,
        type: row.type,
        title: row.title,
        primaryKeyword: row.primary_keyword,
        intent: row.intent,
        format: row.format,
        wordCount: row.word_count,
        priority: row.priority,
        action: row.action,
        existingUrl: row.existing_url,
        optimize: row.optimize,
        notes: row.notes,
        searchVolume: row.search_volume,
        titleTag: row.title_tag,
        metaDescription: row.meta_description,
        collectionSlug: row.collection_slug,
      }));
      
      return NextResponse.json({
        items,
        count: items.length,
      });
    } else if (type === "collections") {
      const rows = collection
        ? await sql`SELECT * FROM collections WHERE collection_slug = ${collection} ORDER BY id`
        : await sql`SELECT * FROM collections ORDER BY id`;

      const items = rows.map((row) => ({
        id: `col-${row.id}`,
        url: row.url,
        category: row.category,
        primaryKeyword: row.primary_keyword,
        searchVolume: row.search_volume,
        keywordDifficulty: row.keyword_difficulty,
        secondaryKeywords: row.secondary_keywords || [],
        optimizedTitleTag: row.optimized_title_tag,
        optimizedMetaDescription: row.optimized_meta_description,
        currentPosition: row.current_position,
        currentImpressions: row.current_impressions,
        priority: row.priority,
        estimatedImpact: row.estimated_impact,
        optimizedEC: row.optimized_ec,
        collectionSlug: row.collection_slug,
      }));
      
      return NextResponse.json({
        items,
        count: items.length,
      });
    }

    // Return both (backward compatible)
    const taRows = collection
      ? await sql`SELECT * FROM topical_authority WHERE collection_slug = ${collection} ORDER BY id`
      : await sql`SELECT * FROM topical_authority ORDER BY id`;
    const colRows = collection
      ? await sql`SELECT * FROM collections WHERE collection_slug = ${collection} ORDER BY id`
      : await sql`SELECT * FROM collections ORDER BY id`;
    
    return NextResponse.json({
      topicalAuthority: {
        items: taRows.map((row) => ({
          id: `ta-${row.id}`,
          type: row.type,
          title: row.title,
          primaryKeyword: row.primary_keyword,
          existingUrl: row.existing_url,
          metaDescription: row.meta_description,
          collectionSlug: row.collection_slug,
        })),
        count: taRows.length,
      },
      collections: {
        items: colRows.map((row) => ({
          id: `col-${row.id}`,
          url: row.url,
          category: row.category,
          primaryKeyword: row.primary_keyword,
          collectionSlug: row.collection_slug,
        })),
        count: colRows.length,
      },
    });
  } catch (error) {
    console.error("Resource fetch error:", error);
    return NextResponse.json({
      items: [],
      count: 0,
      error: "Failed to fetch from database",
    });
  }
}

// DELETE: Clear resources by collection scope
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const collection = searchParams.get("collection");

  try {
    const sql = getSQL();

    if (type === "topical-authority") {
      if (collection) {
        await sql`DELETE FROM topical_authority WHERE collection_slug = ${collection}`;
      } else {
        await sql`DELETE FROM topical_authority`;
      }
      return NextResponse.json({ success: true, message: `Topical authority cleared${collection ? ` for ${collection}` : ''}` });
    } else if (type === "collections") {
      if (collection) {
        await sql`DELETE FROM collections WHERE collection_slug = ${collection}`;
      } else {
        await sql`DELETE FROM collections`;
      }
      return NextResponse.json({ success: true, message: `Collections cleared${collection ? ` for ${collection}` : ''}` });
    }

    return NextResponse.json({ error: "Specify type parameter" }, { status: 400 });
  } catch (error) {
    console.error("Resource delete error:", error);
    return NextResponse.json({ error: "Failed to delete resources" }, { status: 500 });
  }
}
