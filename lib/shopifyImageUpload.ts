/**
 * Shopify Image Upload Utility
 *
 * Uploads images to Shopify Files CDN and returns permanent cdn.shopify.com URLs.
 *
 * FIX (Mar 2026): The polling query was using `... on MediaImage { fileStatus }`
 * which is WRONG — fileStatus lives on the File interface, not MediaImage.
 * When Shopify had any processing issue the fragment returned null for everything,
 * causing the poll to spin silently until Vercel timeout, then fall back to base64.
 *
 * Correct query structure per Shopify docs and Gemini analysis:
 *   node(id) {
 *     ... on File { fileStatus fileErrors { code details } }   ← status + errors
 *     ... on MediaImage { image { url } }                       ← CDN URL when READY
 *   }
 */

import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from "@/lib/shopifyAuth";

const API_VERSIONS = ["2024-10", "2024-07", "2024-04", "2024-01"];

// ── Internal: Shopify Admin GraphQL fetch ─────────────────────────────────────

async function shopifyGraphQL(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const token = await getShopifyAccessToken();

  for (const version of API_VERSIONS) {
    const url = `https://${SHOPIFY_ADMIN_DOMAIN}/admin/api/${version}/graphql.json`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
      });
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      if (res.status === 404) continue;
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Shopify auth failed (${res.status}) — check write_files scope on access token`);
      }
    } catch (err) {
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) throw err;
    }
  }
  throw new Error("All Shopify API versions failed for GraphQL");
}

// ── Shared: Poll until a Shopify file is READY, return CDN URL ────────────────
//
// FIXED: Previously used `... on MediaImage { id fileStatus image { url } }`
// which is incorrect — fileStatus is on the File interface, not MediaImage.
// This caused the poll to always see undefined status and silently loop to timeout.

async function pollForReady(fileId: string, label: string): Promise<string> {
  const maxAttempts = 20;
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollResult = await shopifyGraphQL(
      `query getFile($id: ID!) {
        node(id: $id) {
          ... on File {
            fileStatus
            fileErrors {
              code
              details
              message
            }
          }
          ... on MediaImage {
            image {
              url
            }
          }
        }
      }`,
      { id: fileId }
    );

    const node = (pollResult.data as Record<string, unknown>)?.node as Record<
      string,
      unknown
    > | undefined;

    const fileStatus = node?.fileStatus as string | undefined;
    const fileErrors = node?.fileErrors as Array<{
      code: string;
      details: string;
      message: string;
    }> | undefined;
    const imageUrl = (node?.image as { url?: string } | undefined)?.url;

    console.log(
      `[shopify-upload] ${label} poll ${attempt + 1}/${maxAttempts}: status=${fileStatus ?? "null"}`
    );

    if (fileErrors && fileErrors.length > 0) {
      const errDetails = fileErrors.map((e) => `${e.code}: ${e.message || e.details}`).join(", ");
      throw new Error(`Shopify file processing error — ${errDetails}`);
    }

    if (fileStatus === "READY" && imageUrl) {
      console.log(`[shopify-upload] ${label} READY: ${imageUrl.slice(0, 80)}...`);
      return imageUrl;
    }

    if (fileStatus === "FAILED") {
      throw new Error(`Shopify file processing FAILED for ${fileId}`);
    }
  }

  throw new Error(`Shopify file processing timed out after ${maxAttempts} polls (${label})`);
}

// ── Upload a buffer to Shopify via staged upload ──────────────────────────────

async function uploadBufferToShopify(
  imageBuffer: Buffer,
  mimeType: string,
  altText: string,
  label: string
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const fileName = `ppw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  console.log(
    `[shopify-upload] ${label}: ${Math.round(imageBuffer.byteLength / 1024)}KB, ` +
      `mimeType=${mimeType}, file=${fileName}`
  );

  // 1. Create staged upload — use POST so AWS gets its required auth parameters
  const stagedResult = await shopifyGraphQL(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          resource: "FILE",
          filename: fileName,
          mimeType,
          httpMethod: "POST", // POST so Shopify returns AWS form-data parameters
        },
      ],
    }
  );

  const stagedData = (stagedResult.data as Record<string, unknown>)?.stagedUploadsCreate as
    | Record<string, unknown>
    | undefined;
  const userErrors = stagedData?.userErrors as Array<{ message: string }> | undefined;
  if (userErrors && userErrors.length > 0) {
    throw new Error(`stagedUploadsCreate failed: ${userErrors.map((e) => e.message).join(", ")}`);
  }

  const targets = stagedData?.stagedTargets as
    | Array<{ url: string; resourceUrl: string; parameters: Array<{ name: string; value: string }> }>
    | undefined;
  const target = targets?.[0];
  if (!target) throw new Error("No staged upload target returned from Shopify");

  // 2. POST to AWS using FormData — parameters MUST come first, file MUST come last.
  // AWS presigned POST URLs embed signatures in the form fields. Ignoring them causes
  // a 403 SignatureDoesNotMatch. This was the silent failure root cause.
  console.log(`[shopify-upload] ${label}: POST to AWS with FormData (${target.parameters.length} params)...`);
  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  const fileBlob = new Blob([imageBuffer], { type: mimeType });
  formData.append("file", fileBlob, fileName);

  const uploadRes = await fetch(target.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok && uploadRes.status !== 201) {
    let awsError = "";
    try { awsError = await uploadRes.text(); } catch { awsError = "(unreadable)"; }
    throw new Error(`AWS staged upload failed (${uploadRes.status}): ${awsError.slice(0, 500)}`);
  }
  console.log(`[shopify-upload] ${label}: AWS upload OK (${uploadRes.status})`);

  // 3. Register the file with Shopify
  const fileResult = await shopifyGraphQL(
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id alt }
        userErrors { field message }
      }
    }`,
    {
      files: [
        {
          originalSource: target.resourceUrl,
          alt: altText,
          contentType: "IMAGE",
        },
      ],
    }
  );

  const fileData = (fileResult.data as Record<string, unknown>)?.fileCreate as
    | Record<string, unknown>
    | undefined;
  const fileCreateErrors = fileData?.userErrors as Array<{ message: string }> | undefined;
  if (fileCreateErrors && fileCreateErrors.length > 0) {
    throw new Error(`fileCreate failed: ${fileCreateErrors.map((e) => e.message).join(", ")}`);
  }

  const files = fileData?.files as Array<{ id: string }> | undefined;
  const fileId = files?.[0]?.id;
  if (!fileId) throw new Error("fileCreate returned no file ID");

  console.log(`[shopify-upload] ${label}: fileCreate OK, polling for READY (id=${fileId})...`);

  // 4. Poll until READY using the corrected query (File interface for status, MediaImage for URL)
  return pollForReady(fileId, label);
}

// ── Public: Upload a fal.media URL to Shopify Files ──────────────────────────

export async function uploadFalImageToShopify(
  falUrl: string,
  altText = "Article image"
): Promise<string> {
  console.log(`[shopify-upload] Downloading fal URL: ${falUrl.slice(0, 80)}...`);
  const imageRes = await fetch(falUrl);
  if (!imageRes.ok) throw new Error(`Failed to download fal image: ${imageRes.status}`);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

  return uploadBufferToShopify(imageBuffer, mimeType, altText, "fal-upload");
}

// ── Public: Upload a base64 data URI to Shopify Files ────────────────────────

export async function uploadDataUriToShopify(
  dataUri: string,
  altText = "Article image"
): Promise<string> {
  const match = dataUri.match(/^data:(image\/[\w]+);base64,([\s\S]+)$/);
  if (!match) throw new Error(`Invalid data URI format (length=${dataUri.length})`);

  const mimeType = match[1];
  const imageBuffer = Buffer.from(match[2], "base64");

  // Sharp in add-images/route.ts always outputs image/jpeg — mimeType should be "image/jpeg".
  // If it's still "image/png" here, that means the image wasn't compressed before being passed in.
  if (mimeType === "image/png") {
    console.warn(
      `[shopify-upload] WARNING: uploading as image/png — ensure Sharp compression ` +
        `ran first, otherwise the buffer/Content-Type/stagedUpload will all be consistent ` +
        `but PNG files are larger and slower to process.`
    );
  }

  return uploadBufferToShopify(imageBuffer, mimeType, altText, "data-uri-upload");
}

// ── Helper: Extract alt text from HTML for a given image src ─────────────────
// Looks for <img ... src="THE_URL" ... alt="DESCRIPTION" ...> and returns the alt value.
// Falls back to "Article image" if no alt text is found.

function extractAltTextForSrc(html: string, src: string): string {
  // Escape special regex characters in the src URL
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match an <img> tag containing this src and capture its alt attribute
  const imgTagRegex = new RegExp(
    `<img\\s[^>]*?src=["']${escapedSrc}["'][^>]*?>`,
    "i"
  );
  const imgMatch = html.match(imgTagRegex);
  if (imgMatch) {
    const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
    if (altMatch && altMatch[1] && altMatch[1] !== "Article illustration") {
      return altMatch[1];
    }
  }
  return "Article image";
}

// ── Public: Replace all external/data-URI images in HTML with Shopify CDN URLs

export async function replaceWithShopifyImages(html: string): Promise<string> {
  try {
    let result = html;

    // ── 1. Handle fal.media / fal.run / fal-cdn URLs ──────────────────────────
    const falUrlRegex =
      /https?:\/\/(?:fal\.media|fal\.run|fal-cdn\.net|v3\.fal\.media)[^\s"')]+/g;
    const falMatches = html.match(falUrlRegex);
    if (falMatches && falMatches.length > 0) {
      const uniqueFalUrls = [...new Set(falMatches)];
      console.log(
        `[shopify-upload] Found ${uniqueFalUrls.length} fal.media URLs — uploading in parallel...`
      );
      const falResults = await Promise.all(
        uniqueFalUrls.map(async (falUrl) => {
          try {
            const altText = extractAltTextForSrc(html, falUrl);
            console.log(`[shopify-upload] fal image alt: "${altText}"`);
            const shopifyUrl = await uploadFalImageToShopify(falUrl, altText);
            return { falUrl, shopifyUrl };
          } catch (err) {
            console.error(
              `[shopify-upload] fal upload FAILED for ${falUrl.slice(0, 60)}: `,
              err instanceof Error ? err.message : err
            );
            return { falUrl, shopifyUrl: null };
          }
        })
      );
      for (const { falUrl, shopifyUrl } of falResults) {
        if (shopifyUrl) result = result.replaceAll(falUrl, shopifyUrl);
      }
    }

    // ── 2. Handle base64 data URIs ────────────────────────────────────────────
    // Split on the literal prefix rather than using a regex on the full HTML —
    // safe for arbitrarily large base64 payloads.
    const DATA_URI_MARKER = 'src="data:image/';
    const segments = result.split(DATA_URI_MARKER);

    if (segments.length > 1) {
      const dataUriMap = new Map<string, string>();
      for (let i = 1; i < segments.length; i++) {
        const endQuote = segments[i].indexOf('"');
        if (endQuote > 0) {
          const dataUri = "data:image/" + segments[i].slice(0, endQuote);
          if (!dataUriMap.has(dataUri)) dataUriMap.set(dataUri, "");
        }
      }

      if (dataUriMap.size > 0) {
        console.log(
          `[shopify-upload] Found ${dataUriMap.size} base64 data URI(s) — uploading in parallel...`
        );
        const dataUriResults = await Promise.all(
          Array.from(dataUriMap.keys()).map(async (dataUri, idx) => {
            try {
              const altText = extractAltTextForSrc(html, dataUri);
              console.log(`[shopify-upload] data URI ${idx + 1} alt: "${altText}"`);
              const shopifyUrl = await uploadDataUriToShopify(dataUri, altText);
              console.log(
                `[shopify-upload] data URI ${idx + 1}/${dataUriMap.size} uploaded → ${shopifyUrl.slice(0, 80)}`
              );
              return { dataUri, shopifyUrl };
            } catch (err) {
              console.error(
                `[shopify-upload] data URI ${idx + 1} FAILED (${Math.round(dataUri.length / 1024)}KB): `,
                err instanceof Error ? err.message : err
              );
              return { dataUri, shopifyUrl: null };
            }
          })
        );
        for (const { dataUri, shopifyUrl } of dataUriResults) {
          if (shopifyUrl) result = result.split(dataUri).join(shopifyUrl);
        }
      }
    }

    if (!falMatches?.length && segments.length <= 1) {
      console.log("[shopify-upload] No external or data URI images found in HTML");
    }

    return result;
  } catch (err) {
    console.error("[shopify-upload] replaceWithShopifyImages error:", err);
    return html;
  }
}
