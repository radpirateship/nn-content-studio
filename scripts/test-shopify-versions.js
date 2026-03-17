const domain = "nakednutrition.myshopify.com";
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

const versions = [
  "2026-01", "2025-10", "2025-07", "2025-04", "2025-01",
  "2024-10", "2024-07", "2024-04", "2024-01",
  "2023-10", "2023-07", "2023-04", "2023-01",
];

async function main() {
  for (const v of versions) {
    const url = `https://${domain}/api/${v}/graphql.json`;
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
      console.log(`${v}: ${res.status} - ${body.substring(0, 150)}`);
      if (res.status === 200) {
        console.log("  ^^^ WORKING VERSION ^^^");
        break;
      }
    } catch (e) {
      console.log(`${v}: ERROR - ${e.message}`);
    }
  }
}

main().catch(console.error);
