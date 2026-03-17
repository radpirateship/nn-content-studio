const key = process.env.ANTHROPIC_API_KEY;
const dbUrl = process.env.DATABASE_URL;
console.log("ANTHROPIC_API_KEY present:", !!key, "length:", key?.length || 0, "starts:", key?.substring(0, 8) || "N/A");
console.log("DATABASE_URL present:", !!dbUrl, "length:", dbUrl?.length || 0);
