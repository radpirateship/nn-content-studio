import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Shopify OAuth Callback
 * 
 * After installing the app, Shopify redirects here with an authorization code.
 * We exchange it for a permanent access token and store it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const hmac = searchParams.get("hmac");
  const state = searchParams.get("state");

  console.log("[shopify-auth-callback] Received callback:", { shop, code: code?.slice(0, 10) + "...", state });

  if (!code || !shop) {
    return NextResponse.json({ error: "Missing code or shop parameter" }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const apiSecret = process.env.SHOPIFY_API_SECRET || "";

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set" }, { status: 500 });
  }

  // Verify HMAC
  if (hmac) {
    const params = new URLSearchParams(searchParams);
    params.delete("hmac");
    params.sort();
    const message = params.toString();
    const expectedHmac = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
    if (hmac !== expectedHmac) {
      console.error("[shopify-auth-callback] HMAC verification failed");
      return NextResponse.json({ error: "HMAC verification failed" }, { status: 401 });
    }
  }

  // Exchange code for permanent access token
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[shopify-auth-callback] Token exchange failed:", tokenRes.status, errText);
      return NextResponse.json({ error: `Token exchange failed: ${errText}` }, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
        // Token logged in masked form below — never log full token
    const scope = tokenData.scope;

    console.log("[shopify-auth-callback] SUCCESS! Got access token:", accessToken?.slice(0, 12) + "...");
    console.log("[shopify-auth-callback] Scopes:", scope);

    // Display the token for the user to copy into env vars
    // In production you'd store this in a database
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shopify App Installed Successfully</title>
        <style>
          body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 20px; }
          h1 { color: #1a1a1a; }
          .token-box { background: #f5f5f5; border: 2px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 14px; }
          .success { color: #16a34a; font-weight: 600; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; }
          code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
          button { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
          button:hover { background: #334155; }
        </style>
      </head>
      <body>
        <h1>NN Content Studio</h1>
        <p class="success">App installed successfully!</p>
        <p>Your Shopify Admin API access token:</p>
        <div class="token-box" id="token">${accessToken}</div>
        <button onclick="navigator.clipboard.writeText('${accessToken}').then(() => this.textContent = 'Copied!')">Copy Token</button>
        <div class="warning">
          <strong>Next step:</strong> Copy this token and paste it as <code>SHOPIFY_ACCESS_TOKEN</code> in the Vars sidebar of v0.
          <br><br>
          This token is permanent and will not expire (unless you uninstall the app).
        </div>
        <p>Scopes granted: <code>${scope}</code></p>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("[shopify-auth-callback] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
