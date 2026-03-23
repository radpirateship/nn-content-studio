import { type NextRequest, NextResponse } from "next/server";
import { type Product, CATEGORY_KEYWORDS } from "@/lib/product-store";
import { getCollectionProducts, getProducts, CATEGORY_TO_COLLECTION } from "@/lib/shopify";
import { getSQL } from "@/lib/db";

// Allow large CSV uploads (up to 50MB)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function generateStaticParams() { return [] }

// ── Row mapper ──────────────────────────────────────────────────────────────

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id ?? ""),
    title: (row.title as string) || "",
    description: (row.description as string) || "",
    price: (row.price as string) || "",
    compareAtPrice: (row.compare_at_price as string) || "",
    sku: (row.sku as string) || "",
    vendor: (row.vendor as string) || "",
    productType: (row.product_type as string) || "",
    tags: (row.tags as string) || "",
    category: (row.category as string) || "",
    imageUrl: (row.image_url as string) || "",
    handle: (row.handle as string) || "",
    status: (row.status as string) || "active",
    inventoryQty: (row.inventory_qty as string) || "",
    url: (row.url as string) || "",
  };
}

// ── Fetch products from Shopify Storefront API ──────────────────────────────

async function fetchFromShopify(category?: string, limit = 8): Promise<Product[]> {
  try {
    const collectionHandle = category ? (CATEGORY_TO_COLLECTION[category] || category) : "all";

    let shopifyProducts;
    if (collectionHandle === "all") {
      shopifyProducts = await getProducts({ first: limit, sortKey: "BEST_SELLING" });
    } else {
      shopifyProducts = await getCollectionProducts({
        collection: collectionHandle,
        limit,
        sortKey: "BEST_SELLING",
      });
    }

    return shopifyProducts.map((p) => ({
      id: p.id,
      title: p.title || "",
      description: p.description || "",
      price: p.priceRange?.minVariantPrice?.amount || "0",
      compareAtPrice: "",
      sku: "",
      vendor: "",
      productType: "",
      tags: "",
      category: category || "",
      imageUrl: p.images?.edges?.[0]?.node?.url || "",
      handle: p.handle || "",
      status: "active",
      inventoryQty: "",
      url: `https://nakednutrition.com/products/${p.handle}`,
    }));
  } catch (error) {
    console.error("[products] Failed to fetch from Shopify:", error);
    return [];
  }
}

// ── DB helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch all products from the DB, optionally filtered by collection slug.
 * Returns an empty array (never throws) so callers can fall through.
 */
async function fetchProductsFromDB(collectionSlug?: string | null): Promise<Product[]> {
  try {
    const sql = getSQL();
    const rows = collectionSlug
      ? await sql`SELECT * FROM products WHERE collection_slug = ${collectionSlug} ORDER BY title`
      : await sql`SELECT * FROM products ORDER BY title LIMIT 500`;
    return rows.map(rowToProduct);
  } catch (error) {
    console.error("[products] DB query failed:", error);
    return [];
  }
}

/**
 * Extract unique category strings from a product list (DB-backed replacement
 * for the old in-memory productStore.getCategories()).
 */
function extractCategories(products: Product[]): string[] {
  const categories = new Set<string>();
  for (const p of products) {
    if (p.category) categories.add(p.category);
    if (p.productType) categories.add(p.productType);
  }
  return Array.from(categories).filter(Boolean).sort();
}

/**
 * Filter products by category using the same keyword matching as the old
 * in-memory store, but operating on an array instead of mutable state.
 */
function filterByCategory(products: Product[], category: string): Product[] {
  const keywords = CATEGORY_KEYWORDS[category] || [category.replace(/-/g, " ")];
  return products.filter((p) => {
    const text = [p.title, p.description, p.productType, p.tags, p.category, p.vendor]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return keywords.some((kw) => text.includes(kw.toLowerCase()));
  });
}

// ============================================================================
// RELEVANCE SCORING — match products to article content
// ============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are', 'were', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'can', 'may', 'would',
  'should', 'could', 'this', 'that', 'these', 'those', 'my', 'your', 'our',
  'its', 'his', 'her', 'their', 'what', 'which', 'who', 'how', 'why', 'when',
  'where', 'not', 'no', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'just', 'also', 'about',
  'best', 'top', 'good', 'great', 'new', 'use', 'using', 'used', 'guide',
  'review', 'complete', 'ultimate', 'vs', 'versus', '2024', '2025', '2026',
]);

function extractSearchTerms(searchString: string): string[] {
  return searchString
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreProduct(product: Product, searchTerms: string[]): number {
  if (searchTerms.length === 0) return 0;
  const titleLower = (product.title || '').toLowerCase();
  const tagsLower = (product.tags || '').toLowerCase();
  const typeLower = (product.productType || '').toLowerCase();
  const handleLower = (product.handle || '').toLowerCase();
  const descLower = (product.description || '').slice(0, 500).toLowerCase();
  let score = 0;
  for (const term of searchTerms) {
    if (titleLower.includes(term)) score += 10;
    if (handleLower.includes(term)) score += 6;
    if (tagsLower.includes(term)) score += 5;
    if (typeLower.includes(term)) score += 4;
    if (descLower.includes(term)) score += 2;
  }
  if (product.imageUrl) score += 8;
  if (product.price && product.price !== '0') score += 3;
  return score;
}

function selectRelevantProducts(allProducts: Product[], searchTerms: string[], maxItems: number): Product[] {
  const scored = allProducts.map(p => ({
    product: p,
    relevance: scoreProduct(p, searchTerms),
    tiebreaker: Math.random(),
  }));
  scored.sort((a, b) => b.relevance !== a.relevance ? b.relevance - a.relevance : a.tiebreaker - b.tiebreaker);
  const topScore = scored[0]?.relevance || 0;
  console.log(`[products] Product scoring: ${scored.length} products, top score=${topScore}, search="${searchTerms.join(' ')}"`);
  if (scored.length > 0) {
    console.log(`[products] Top 6 matches: ${scored.slice(0, 6).map(s => `${s.product.title?.slice(0, 40)} (${s.relevance})`).join(' | ')}`);
  }
  return scored.slice(0, maxItems).map(s => s.product);
}

// ============================================================================
// GET HANDLER — all reads go through the DB (cold-start safe, no race conditions)
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const collection = searchParams.get("collection");
  const search = searchParams.get("search");
  const limit = searchParams.get("limit");
  const maxItems = parseInt(limit || "8", 10);

  console.log(`[products GET] category="${category}", collection="${collection}", search="${search}"`);

  const collectionSlug = collection || (category ? (CATEGORY_TO_COLLECTION[category] || category) : null);

  // PRIORITY 1: Database products with relevance scoring
  if (collectionSlug && collectionSlug !== "all") {
    const sql = getSQL();
    try {
      let rows = await sql`SELECT * FROM products WHERE collection_slug = ${collectionSlug}`;
      console.log(`[products GET] DB (slug="${collectionSlug}") → ${rows.length} rows`);

      // Fallback: ILIKE search if exact slug misses
      if (rows.length === 0) {
        const fallbackTerm = `%${(category || collectionSlug).replace(/-/g, '%')}%`;
        rows = await sql`SELECT * FROM products WHERE category ILIKE ${fallbackTerm} OR product_type ILIKE ${fallbackTerm} OR collection_slug ILIKE ${fallbackTerm}`;
        console.log(`[products GET] DB (ILIKE) → ${rows.length} rows`);
      }

      if (rows.length > 0) {
        const dbProducts = rows.map(rowToProduct);
        const searchTerms = search ? extractSearchTerms(search) : [];
        const selectedProducts = searchTerms.length > 0
          ? selectRelevantProducts(dbProducts, searchTerms, maxItems)
          : selectRelevantProducts(dbProducts, collectionSlug.replace(/-/g, ' ').split(' '), maxItems);
        return NextResponse.json({ products: selectedProducts, total: dbProducts.length, source: "database-scored", collectionSlug });
      }
    } catch (error) {
      console.error("[products] DB scored query failed:", error);
    }
  }

  // PRIORITY 2: Shopify Storefront API fallback
  if (category && category !== "all") {
    console.log(`[products] No DB products for "${collectionSlug}", trying Shopify API`);
    const shopifyProducts = await fetchFromShopify(category, Math.max(maxItems * 4, 20));
    if (shopifyProducts.length > 0) {
      const searchTerms = search ? extractSearchTerms(search) : [];
      const selected = searchTerms.length > 0 ? selectRelevantProducts(shopifyProducts, searchTerms, maxItems) : shopifyProducts.slice(0, maxItems);
      return NextResponse.json({ products: selected, total: shopifyProducts.length, source: "shopify-scored" });
    }
  }

  // PRIORITY 3: All products from DB (no in-memory store dependency)
  const allProducts = await fetchProductsFromDB(null);
  let products = allProducts;

  if (category && category !== "all") {
    products = filterByCategory(allProducts, category);
    if (products.length === 0) {
      // Broad fallback: match any category word in product text
      const categoryWords = category.toLowerCase().replace(/-/g, ' ').split(' ');
      products = allProducts.filter(p => {
        const searchText = [p.title, p.description, p.productType, p.tags, p.vendor].filter(Boolean).join(' ').toLowerCase();
        return categoryWords.some(word => word.length > 2 && searchText.includes(word));
      });
    }
  }

  const totalBeforeLimit = products.length;
  if (search && products.length > 0) {
    const searchTerms = extractSearchTerms(search);
    if (searchTerms.length > 0) products = selectRelevantProducts(products, searchTerms, maxItems);
  } else {
    products = products.map(p => ({ product: p, sort: (p.imageUrl ? 100 : 0) + (p.price ? 10 : 0) + Math.random() * 5 }))
      .sort((a: { sort: number }, b: { sort: number }) => b.sort - a.sort).slice(0, maxItems).map((s: { product: Product }) => s.product);
  }
  return NextResponse.json({ products: products.slice(0, maxItems), total: totalBeforeLimit, categories: extractCategories(allProducts) });
}

// ============================================================================
// POST HANDLER — writes to DB (source of truth)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    let products: Product[] = [];
    let collectionSlug: string | null = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      collectionSlug = body.collection_slug || null;
      products = (body.products || []).map((p: Record<string, string>) => ({
        id: p.id || p.handle || `product-${Math.random().toString(36).slice(2)}`,
        title: p.title || "", description: p.description || "", price: p.price || "",
        compareAtPrice: p.compareAtPrice || "", sku: p.sku || "", vendor: p.vendor || "",
        productType: p.productType || "", tags: p.tags || "", category: p.category || p.productType || "",
        imageUrl: p.imageUrl || "", handle: p.handle || "", status: p.status || "active",
        inventoryQty: p.inventoryQty || "", url: p.url || "",
      }));
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      collectionSlug = formData.get("collection_slug") as string | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      const text = await file.text();
      const lines = text.split("\n");
      if (lines.length < 2) return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
      const headers = parseCSVLine(lines[0]);
      const headerLower: Record<string, string> = {};
      headers.forEach((h) => { headerLower[h.trim().toLowerCase()] = h.trim(); });
      const col = (keys: string[]): string => {
        for (const k of keys) {
          const found = headerLower[k.toLowerCase()];
          if (found) return found;
        }
        return "";
      };
      const hTitle = col(["Title", "title"]);
      const hHandle = col(["Handle", "handle"]);
      const hDesc = col(["Body (HTML)", "Body HTML", "description"]);
      const hPrice = col(["Variant Price", "price"]);
      const hCompare = col(["Variant Compare At Price", "compareAtPrice", "compare_at_price"]);
      const hSku = col(["Variant SKU", "sku"]);
      const hVendor = col(["Vendor", "vendor"]);
      const hType = col(["Product Type", "Type", "productType", "product_type"]);
      const hTags = col(["Tags", "tags"]);
      const hCategory = col(["Product Type", "Type", "category"]);
      const hImage = col(["Image Src", "imageUrl", "image_url"]);
      const hStatus = col(["Status", "status"]);
      const hInv = col(["Total Inventory Qty", "Variant Inventory Qty", "inventoryQty", "inventory_qty"]);
      const hUrl = col(["URL", "url"]);
      const hId = col(["ID", "id"]);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCSVLine(line);
        const product: Record<string, string> = {};
        headers.forEach((header, index) => { product[header.trim()] = values[index]?.trim() || ""; });
        const title = (hTitle ? product[hTitle] : "") || "";
        const handle = (hHandle ? product[hHandle] : "") || "";
        if (!title && products.length > 0 && products[products.length - 1].handle === handle) continue;
        if (title) {
          products.push({
            id: (hId ? product[hId] : "") || handle || `product-${i}`, title,
            description: (hDesc ? product[hDesc] : "") || "",
            price: (hPrice ? product[hPrice] : "") || "",
            compareAtPrice: (hCompare ? product[hCompare] : "") || "",
            sku: (hSku ? product[hSku] : "") || "",
            vendor: (hVendor ? product[hVendor] : "") || "",
            productType: (hType ? product[hType] : "") || "",
            tags: (hTags ? product[hTags] : "") || "",
            category: (hCategory ? product[hCategory] : "") || "",
            imageUrl: (hImage ? product[hImage] : "") || "",
            handle,
            status: (hStatus ? product[hStatus] : "") || "active",
            inventoryQty: (hInv ? product[hInv] : "") || "",
            url: (hUrl ? product[hUrl] : "") || "",
          });
        }
      }
    }

    if (products.length === 0) return NextResponse.json({ error: "No products found in file" }, { status: 400 });

    // Write to DB (source of truth)
    const sql = getSQL();
    if (collectionSlug) {
      await sql`DELETE FROM products WHERE collection_slug = ${collectionSlug}`;
    } else {
      await sql`DELETE FROM products WHERE collection_slug IS NULL`;
    }
    const sortedProducts = [...products].sort((a, b) => (a.imageUrl && !b.imageUrl ? -1 : !a.imageUrl && b.imageUrl ? 1 : 0));
    const productsToSave = sortedProducts.filter(p => p.title).slice(0, 1000);
    const handleCounts: Record<string, number> = {};
    for (let i = 0; i < productsToSave.length; i++) {
      const p = productsToSave[i];
      let uniqueHandle = p.handle || `product-${i}`;
      if (handleCounts[uniqueHandle] !== undefined) {
        handleCounts[uniqueHandle]++;
        uniqueHandle = `${p.handle}-${handleCounts[uniqueHandle]}`;
      } else {
        handleCounts[uniqueHandle] = 0;
      }
      try {
        await sql`
          INSERT INTO products (handle, title, description, price, compare_at_price, sku, vendor, product_type, tags, category, image_url, status, inventory_qty, url, collection_slug)
          VALUES (${uniqueHandle}, ${p.title}, ${p.description?.slice(0, 5000)}, ${p.price}, ${p.compareAtPrice}, ${p.sku}, ${p.vendor}, ${p.productType}, ${p.tags}, ${p.category}, ${p.imageUrl}, ${p.status}, ${p.inventoryQty}, ${p.url}, ${collectionSlug || null})
          ON CONFLICT (handle) DO UPDATE SET
            title = EXCLUDED.title, description = EXCLUDED.description, price = EXCLUDED.price,
            compare_at_price = EXCLUDED.compare_at_price, vendor = EXCLUDED.vendor,
            product_type = EXCLUDED.product_type, tags = EXCLUDED.tags, category = EXCLUDED.category,
            image_url = EXCLUDED.image_url, status = EXCLUDED.status, inventory_qty = EXCLUDED.inventory_qty,
            url = EXCLUDED.url, collection_slug = EXCLUDED.collection_slug
        `;
      } catch (e) {
        console.error('[products] Failed to insert product:', uniqueHandle, e);
      }
      if (i > 0 && i % 50 === 0) await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`[products] Saved ${productsToSave.length} products to DB${collectionSlug ? ` (collection: ${collectionSlug})` : ''}`);

    return NextResponse.json({
      success: true,
      count: products.length,
      categories: extractCategories(products),
      collectionSlug: collectionSlug || null,
      sample: products.slice(0, 5),
    });
  } catch (error) {
    console.error("[products] CSV parse error:", error);
    return NextResponse.json({ error: "Failed to parse CSV file" }, { status: 500 });
  }
}

// ============================================================================
// DELETE HANDLER — clears DB (source of truth)
// ============================================================================

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get("collection");
  try {
    const sql = getSQL();
    if (collection) await sql`DELETE FROM products WHERE collection_slug = ${collection}`;
    else await sql`DELETE FROM products`;
    return NextResponse.json({ success: true, message: collection ? `Products cleared for ${collection}` : "All products removed" });
  } catch (error) {
    console.error("[products] Error clearing products:", error);
    return NextResponse.json({ error: "Failed to clear products" }, { status: 500 });
  }
}

// ============================================================================
// CSV parser
// ============================================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else current += char;
  }
  result.push(current);
  return result;
}
