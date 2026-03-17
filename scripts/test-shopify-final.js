const domain = "peakprimal.myshopify.com";
const tokens = {
  "SHOPIFY_STOREFRONT_ACCESS_TOKEN": process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
  "SHOPIFY_ACCESS_TOKEN": process.env.SHOPIFY_ACCESS_TOKEN,
  "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN (token)": process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
  "SHOPIFY_STORE_DOMAIN (might be token)": process.env.SHOPIFY_STORE_DOMAIN,
};

async function main() {
  for (const [name, token] of Object.entries(tokens)) {
    if (!token) continue;
    const url = `https://${domain}/api/2024-01/graphql.json`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": token,
        },
        body: JSON.stringify({ query: `{ shop { name } }` }),
      });
      const body = await res.text();
      console.log(`${name}: ${res.status} - ${body.substring(0, 300)}`);
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`);
    }
  }
}

main().catch(console.error);
