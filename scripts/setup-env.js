import { writeFileSync } from "fs";

const vars = [
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_STOREFRONT_ACCESS_TOKEN',
  'SHOPIFY_ACCESS_TOKEN',
  'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'FAL_KEY',
];
const lines = [];

for (const v of vars) {
  if (process.env[v]) {
    lines.push(`${v}=${process.env[v]}`);
    console.log(`${v}: present (${process.env[v].length} chars)`);
  } else {
    console.log(`${v}: NOT SET`);
  }
}

writeFileSync(".env.local", lines.join("\n") + "\n");
console.log(".env.local written with", lines.length, "variables");
