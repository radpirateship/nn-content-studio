const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

console.log("Domain:", domain);
console.log("Token length:", token?.length);

const versions = ["2025-01", "2024-10", "2024-07", "2024-04", "2024-01", "2023-10", "2023-07"];

async function testVersion(version) {
  const url = `https://${domain}/api/${version}/graphql.json`;
  try {
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
    const body = await res.text();
    console.log(`Version ${version}: ${res.status} - ${body.substring(0, 200)}`);
  } catch (e) {
    console.log(`Version ${version}: ERROR - ${e.message}`);
  }
}

async function main() {
  for (const v of versions) {
    await testVersion(v);
  }

  // Also test the steam collection
  const workingVersion = "2024-01";
  const url = `https://${domain}/api/${workingVersion}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{ collection(handle: "steam") { title productsCount { count } products(first: 4) { edges { node { title } } } } }`,
    }),
  });
  const data = await res.text();
  console.log("\nSteam collection test:", res.status, data.substring(0, 500));
}

main().catch(console.error);
