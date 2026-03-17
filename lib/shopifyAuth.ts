/**
 * Shopify Admin API Authentication
 * 
 * Uses a stored shpat_ access token from the OAuth authorization code flow.
 * The token is obtained during app installation via /api/shopify/auth/callback
 * and stored as SHOPIFY_ACCESS_TOKEN env var.
 * 
 * For Partner/Dev Dashboard apps, the client credentials grant is NOT available.
 * Tokens from the authorization code flow are permanent (don't expire).
 */

export const SHOPIFY_ADMIN_DOMAIN = "nakednutrition.myshopify.com";

/**
 * Get the Shopify Admin API access token.
 * 
 * Reads from SHOPIFY_ACCESS_TOKEN env var (set via OAuth callback after app install).
 */
export async function getShopifyAccessToken(): Promise<string> {
  const rawToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
  const envToken = rawToken.replace(/^["'\s]+|["'\s]+$/g, "");

  if (envToken.startsWith("shpat_") && envToken.length > 10) {
    return envToken;
  }

  throw new Error("SHOPIFY_ACCESS_TOKEN environment variable is not set");
}
