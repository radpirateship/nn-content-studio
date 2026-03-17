const domain = "nakednutrition.myshopify.com";
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

console.log("Token length:", token?.length, "first 8:", token?.substring(0, 8));

async function test() {
  const url = `https://${domain}/api/2024-01/graphql.json`;
  console.log("Testing URL:", url);
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{ shop { name } }`,
    }),
  });
  console.log("Shop query:", res.status, await res.text());

  // Test steam collection
  const res2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{ collection(handle: "steam") { title products(first: 4) { edges { node { title priceRange { minVariantPrice { amount } } } } } } }`,
    }),
  });
  console.log("Steam collection:", res2.status, await res2.text());
}

test().catch(console.error);
