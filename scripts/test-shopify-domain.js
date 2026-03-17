const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

const domains = [
  "nakednutrition.myshopify.com",
  "naked-nutrition.myshopify.com",
  "nn-store.myshopify.com",
];

async function testDomain(domain) {
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
    console.log(`${domain}: ${res.status} - ${body.substring(0, 200)}`);
  } catch (e) {
    console.log(`${domain}: ERROR - ${e.message}`);
  }
}

async function main() {
  for (const d of domains) {
    await testDomain(d);
  }
}

main().catch(console.error);
