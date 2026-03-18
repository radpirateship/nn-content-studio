import { type NextRequest, NextResponse } from "next/server";
import { productStore, type Product } from "@/lib/product-store";
import { getCollectionProducts, getProducts, CATEGORY_TO_COLLECTION } from "@/lib/shopify";
import { getSQL } from "@/lib/db";

// Allow large CSV uploads (up to 50MB)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function generateStaticParams() { return [] }

// Load products from database into memory store on first request
let isInitialized = false;

// Fetch products from Shopify Storefront API
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
    console.error("[v0] Failed to fetch from Shopify:", error);
    return [];
  }
}

async function initializeFromDatabase(collectionSlug?: string) {
  if (isInitialized && productStore.getAll().length > 0 && !collectionSlug) return;
  
  try {
    const sql = getSQL();
    const rows = collectionSlug
      ? await sql`SELECT * FROM products WHERE collection_slug = ${collectionSlug} ORDER BY title`
      : await sql`SELECT * FROM products ORDER BY title`;
    if (rows.length > 0) {
      const products: Product[] = rows.map(row => ({
        id: row.id.toString(),
        title: row.title || "",
        description: row.description || "",
        price: row.price || "",
        compareAtPrice: row.compare_at_price || "",
        sku: row.sku || "",
        vendor: row.vendor || "",
        productType: row.product_type || "",
        tags: row.tags || "",
        category: row.category || "",
        imageUrl: row.image_url || "",
        handle: row.handle || "",
        status: row.status || "active",
        inventoryQty: row.inventory_qty || "",
        url: row.url || "",
      }));
      productStore.setProducts(products);
      console.log(`[v0] Loaded ${products.length} products from database${collectionSlug ? ` (collection: ${collectionSlug})` : ''}`);
    }
    isInitialized = true;
  } catch (error) {
    console.error("[v0] Failed to load products from database:", error);
  }
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
  console.log(`[v0] Product scoring: ${scored.length} products, top score=${topScore}, search="${searchTerms.join(' ')}"`);
  if (scored.length > 0) {
    console.log(`[v0] Top 6 matches: ${scored.slice(0, 6).map(s => `${s.product.title?.slice(0, 40)} (${s.relevance})`).join(' | ')}`);
  }
  return scored.slice(0, maxItems).map(s => s.product);
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const collection = searchParams.get("collection");
  const search = searchParams.get("search");
  const limit = searchParams.get("limit");
  const maxItems = parseInt(limit || "8", 10);

  console.log(`[Products GET] Incoming - category: "${category}", collection: "${collection}", search: "${search}"`);

  const collectionSlug = collection || (category ? (CATEGORY_TO_COLLECTION[category] || category) : null);
  console.log(`[Products GET] Resolved collectionSlug: "${collectionSlug}"`);

  // PRIORITY 1: Database products with relevance scoring
  if (collectionSlug && collectionSlug !== "all") {
    try {
      const sql = getSQL();
      let rows = await sql`SELECT * FROM products WHERE collection_slug = ${collectionSlug}`;
      console.log(`[Products GET] DB Query (exact slug = '${collectionSlug}') returned ${rows.length} rows.`);

      // FALLBACK: If exact slug misses, try a broad ILIKE search
      if (rows.length === 0) {
        const fallbackTerm = `%${(category || collectionSlug).replace(/-/g, '%')}%`;
        console.log(`[Products GET] Exact match missed. Falling back to ILIKE '${fallbackTerm}'`);
        rows = await sql`SELECT * FROM products WHERE category ILIKE ${fallbackTerm} OR product_type ILIKE ${fallbackTerm} OR collection_slug ILIKE ${fallbackTerm}`;
        console.log(`[Products GET] DB Query (ILIKE) returned ${rows.length} rows.`);
      }

      if (rows.length > 0) {
        const dbProducts: Product[] = rows.map(row => ({
          id: row.id.toString(), title: row.title || "", description: row.description || "",
          price: row.price || "", compareAtPrice: row.compare_at_price || "", sku: row.sku || "",
          vendor: row.vendor || "", productType: row.product_type || "", tags: row.tags || "",
          category: row.category || "", imageUrl: row.image_url || "", handle: row.handle || "",
          status: row.status || "active", inventoryQty: row.inventory_qty || "", url: row.url || "",
        }));
        const searchTerms = search ? extractSearchTerms(search) : [];
        const selectedProducts = searchTerms.length > 0
          ? selectRelevantProducts(dbProducts, searchTerms, maxItems)
          : selectRelevantProducts(dbProducts, collectionSlug.replace(/-/g, ' ').split(' '), maxItems);
        console.log(`[v0] Products: matched ${selectedProducts.length}/${dbProducts.length} from DB (collection: ${collectionSlug})`);
        return NextResponse.json({ products: selectedProducts, total: dbProducts.length, source: "database-scored", collectionSlug });
      } else {
        console.log(`[Products GET] DB returned 0 rows. Falling through to Shopify API...`);
        // No hard return — fall through to Priority 2
      }
    } catch (error) {
      console.error("[v0] Failed to fetch scored products from DB:", error);
    }
  }

  // PRIORITY 2: Shopify Storefront API fallback
  if (category && category !== "all") {
    console.log(`[v0] Products: no DB products for "${collectionSlug}", trying Shopify API`);
    const shopifyProducts = await fetchFromShopify(category, Math.max(maxItems * 4, 20));
    if (shopifyProducts.length > 0) {
      const searchTerms = search ? extractSearchTerms(search) : [];
      const selected = searchTerms.length > 0 ? selectRelevantProducts(shopifyProducts, searchTerms, maxItems) : shopifyProducts.slice(0, maxItems);
      console.log(`[v0] Products: scored ${selected.length}/${shopifyProducts.length} from Shopify`);
      return NextResponse.json({ products: selected, total: shopifyProducts.length, source: "shopify-scored" });
    }
  }

  // PRIORITY 3: In-memory store fallback
  isInitialized = false;
  await initializeFromDatabase();
  let products = productStore.getAll();
  if (category && category !== "all") {
    products = productStore.getByCategory(category);
    if (products.length === 0) {
      const allProducts = productStore.getAll();
      const categoryWords = category.toLowerCase().replace(/-/g, ' ').split(' ');
      products = allProducts.filter(p => {
        const searchText = [p.title, p.description, p.productType, p.tags, p.vendor].filter(Boolean).join(' ').toLowerCase();
        return categoryWords.some(word => word.length > 2 && searchText.includes(word));
      });
    }
  }
  if (search && products.length > 0) {
    const searchTerms = extractSearchTerms(search);
    if (searchTerms.length > 0) products = selectRelevantProducts(products, searchTerms, maxItems);
  } else {
    products = products.map(p => ({ product: p, sort: (p.imageUrl ? 100 : 0) + (p.price ? 10 : 0) + Math.random() * 5 }))
      .sort((a, b) => b.sort - a.sort).slice(0, maxItems).map(s => s.product);
  }
  return NextResponse.json({ products: products.slice(0, maxItems), total: products.length, categories: productStore.getCategories() });
}

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
      // Build a case-insensitive header lookup so both Shopify export format
      // (Title, Handle, Body (HTML), Variant Price, Image Src) and NN custom
      // format (title, handle, description, price, imageUrl) work
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

    productStore.setProducts(products);

    try {
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
          console.error('[v0] Failed to insert product:', uniqueHandle, e);
        }
        if (i > 0 && i % 50 === 0) await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log(`[v0] Saved ${productsToSave.length} products to database${collectionSlug ? ` (collection: ${collectionSlug})` : ''}`);
    } catch (dbError) {
      console.error("[v0] Failed to save products to database:", dbError);
    }

    isInitialized = true;
    return NextResponse.json({ success: true, count: products.length, categories: productStore.getCategories(), collectionSlug: collectionSlug || null, sample: products.slice(0, 5) });
  } catch (error) {
    console.error("CSV parse error:", error);
    return NextResponse.json({ error: "Failed to parse CSV file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get("collection");
  try {
    productStore.clear();
    isInitialized = false;
    try {
      const sql = getSQL();
      if (collection) await sql`DELETE FROM products WHERE collection_slug = ${collection}`;
      else await sql`DELETE FROM products`;
    } catch (dbError) {
      console.error("[v0] Failed to clear products from database:", dbError);
    }
    return NextResponse.json({ success: true, message: collection ? `Products cleared for ${collection}` : "All products removed" });
  } catch (error) {
    console.error("[v0] Error clearing products:", error);
    return NextResponse.json({ error: "Failed to clear products" }, { status: 500 });
  }
}

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
