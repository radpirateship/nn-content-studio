import { ProductCollectionSortKey, ProductSortKey, ShopifyProduct } from "./types";
import { parseShopifyDomain } from "./parse-shopify-domain";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_KEY } from "./constants";
import { withRetry } from "../retry";

const SHOPIFY_API_VERSION = "2025-01";
const SHOPIFY_TIMEOUT_MS = 15_000; // 15 seconds per request

// Read ALL Shopify config lazily at request time (not module load)
function getShopifyConfig() {
  const rawDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "";

  if (!rawDomain) {
    throw new Error(
      "SHOPIFY_STORE_DOMAIN (or NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) is not set. " +
      "Add it in your .env.local file (e.g. nakednutrition.myshopify.com)."
    );
  }

  // Validate the domain looks like an actual domain (contains a dot)
  // and isn't accidentally set to an API key/token (starts with "shp")
  const isValidDomain = rawDomain.includes(".") && !rawDomain.startsWith("shp");
  if (!isValidDomain) {
    throw new Error(
      `SHOPIFY_STORE_DOMAIN is set to "${rawDomain.slice(0, 20)}…" which does not look like a valid domain. ` +
      `Expected a value like "your-store.myshopify.com".`
    );
  }

  const domain = parseShopifyDomain(rawDomain);
  const url = `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  return { domain, url, token };
}

// Shopify Storefront API request with token, timeout, and retry
async function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<{ data: T; errors?: unknown[] }> {
  const { url, token } = getShopifyConfig();

  if (!token) {
    throw new Error("SHOPIFY_STOREFRONT_ACCESS_TOKEN is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": token,
  };

  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SHOPIFY_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shopify API HTTP error! Status: ${response.status}, Body: ${errorBody}`);
      }

      const json = await response.json();

      if (json.errors) {
        console.error("Shopify API errors:", json.errors);
        throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
      }

      return json;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Shopify API request timed out after ${SHOPIFY_TIMEOUT_MS / 1000}s`);
      }
      console.error("Shopify fetch error:", error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }, { label: 'Shopify', maxRetries: 2 });
}

// Get products from a specific collection
export async function getCollectionProducts({
  collection,
  limit = DEFAULT_PAGE_SIZE,
  sortKey = DEFAULT_SORT_KEY as ProductCollectionSortKey,
  reverse = false,
}: {
  collection: string;
  limit?: number;
  sortKey?: ProductCollectionSortKey;
  reverse?: boolean;
}): Promise<ShopifyProduct[]> {
  const query = `
    query getCollectionProducts($handle: String!, $first: Int!, $sortKey: ProductCollectionSortKeys!, $reverse: Boolean) {
      collection(handle: $handle) {
        products(first: $first, sortKey: $sortKey, reverse: $reverse) {
          edges {
            node {
              id
              title
              description
              handle
              availableForSale
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<{
    collection: {
      products: {
        edges: Array<{ node: ShopifyProduct }>;
      };
    } | null;
  }>({
    query,
    variables: { handle: collection, first: limit, sortKey, reverse },
  });

  if (!data.collection) {
    return [];
  }

  return data.collection.products.edges.map((edge) => edge.node);
}

// Get all products
export async function getProducts({
  first = DEFAULT_PAGE_SIZE,
  sortKey = DEFAULT_SORT_KEY as ProductSortKey,
  reverse = false,
  query: searchQuery,
}: {
  first?: number;
  sortKey?: ProductSortKey;
  reverse?: boolean;
  query?: string;
}): Promise<ShopifyProduct[]> {
  const gqlQuery = `
    query getProducts($first: Int!, $sortKey: ProductSortKeys!, $reverse: Boolean, $query: String) {
      products(first: $first, sortKey: $sortKey, reverse: $reverse, query: $query) {
        edges {
          node {
            id
            title
            description
            handle
            availableForSale
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<{
    products: {
      edges: Array<{ node: ShopifyProduct }>;
    };
  }>({
    query: gqlQuery,
    variables: { first, sortKey, reverse, query: searchQuery },
  });

  return data.products.edges.map((edge) => edge.node);
}

// Maps internal category/collection slugs to Shopify collection handles
// All slugs match live Naked Nutrition collections at nakednutrition.com/collections/<slug>
export const CATEGORY_TO_COLLECTION: Record<string, string> = {
  // Protein
  "protein-powder": "protein-powder",
  "whey-protein": "whey-protein",
  "vegan-protein-powder": "vegan-protein-powder",
  // Collagen
  "collagen-peptides": "collagen-peptides",
  // Other products
  "overnight-oats": "overnight-oats",
  "improve-performance-recovery": "improve-performance-recovery",
  "supplements": "supplements",
  "kids": "kids",
  // NNCategory aliases → nearest collection
  "whey": "whey-protein",
  "casein-protein": "protein-powder",
  "pea-protein": "vegan-protein-powder",
  "rice-protein": "vegan-protein-powder",
  "mass-gainer": "protein-powder",
  "pre-workout": "improve-performance-recovery",
  "post-workout": "improve-performance-recovery",
  "bcaa": "improve-performance-recovery",
  "collagen": "collagen-peptides",
  "greens": "supplements",
  "fiber": "supplements",
  "vitamins": "supplements",
  "probiotics": "supplements",
  "energy": "supplements",
  "weight-management": "supplements",
  "keto": "supplements",
  "vegan": "vegan-protein-powder",
  "creatine": "supplements",
  "general-nutrition": "supplements",
};
