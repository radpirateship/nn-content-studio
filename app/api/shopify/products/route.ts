import { type NextRequest, NextResponse } from "next/server";
import { getCollectionProducts, getProducts, CATEGORY_TO_COLLECTION } from "@/lib/shopify";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "all";
    const limit = parseInt(searchParams.get("limit") || "4", 10);

    let products;

    // Map category to Shopify collection handle
    const collectionHandle = CATEGORY_TO_COLLECTION[category] || category;

    if (collectionHandle === "all") {
      // Get all products if no specific collection
      products = await getProducts({ first: limit, sortKey: "BEST_SELLING" });
    } else {
      // Get products from specific collection
      products = await getCollectionProducts({
        collection: collectionHandle,
        limit,
        sortKey: "BEST_SELLING",
      });
    }

    // Transform to simplified format for article generation
    const simplifiedProducts = products.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      price: p.priceRange?.minVariantPrice?.amount || "0",
      imageUrl: p.images?.edges?.[0]?.node?.url || null,
      url: `https://nakednutrition.com/products/${p.handle}`,
      availableForSale: p.availableForSale,
    }));

    return NextResponse.json({ products: simplifiedProducts });
  } catch (error) {
    console.error("Shopify products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", products: [] },
      { status: 500 }
    );
  }
}
