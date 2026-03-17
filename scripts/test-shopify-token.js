const domain = "nakednutrition.myshopify.com";
const storefrontToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const apiKey = process.env.SHOPIFY_API_KEY;
const nextPublicDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;

console.log("SHOPIFY_STOREFRONT_ACCESS_TOKEN:", storefrontToken?.substring(0, 12) + "...", "length:", storefrontToken?.length);
console.log("SHOPIFY_ACCESS_TOKEN:", accessToken?.substring(0, 12) + "...", "length:", accessToken?.length);
console.log("SHOPIFY_API_KEY:", apiKey?.substring(0, 12) + "...", "length:", apiKey?.length);
console.log("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN:", nextPublicDomain);

const tokens = [
  { name: "SHOPIFY_ACCESS_TOKEN", val: accessToken },
  { name: "SHOPIFY_API_KEY", val: apiKey },
  { name: "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN (as token)", val: nextPublicDomain },
];

async function testToken(name, token) {
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
    console.log(`\n${name}: status ${res.status} - ${body.substring(0, 300)}`);
  } catch (e) {
    console.log(`\n${name}: ERROR - ${e.message}`);
  }
}

async function main() {
  for (const t of tokens) {
    if (t.val) await testToken(t.name, t.val);
  }
}

main().catch(console.error);
