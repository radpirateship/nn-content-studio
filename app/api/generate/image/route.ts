import { type NextRequest, NextResponse } from "next/server";
import { generateImageWithModel, type ImageModel } from "@/lib/imageGeneration";

/**
 * POST /api/generate/image
 * Featured image generation for the Shopify blog post featured_image field.
 * Uses Gemini image generation.
 */
export async function POST(request: NextRequest) {
  try {
    const { title, category, style = "photorealistic", model = "gemini-nano-banana" } = await request.json();

    const imagePrompt = generateImagePrompt(title, category, style);
    const imageModel: ImageModel = 'gemini-nano-banana';

    console.log(`[featured-image] Generating with ${imageModel}`);

    const result = await generateImageWithModel(imagePrompt, imageModel, {
      style: 'realistic_image',
      imageSize: 'landscape_16_9',
      aspectRatio: '16:9',
    });

  if (result) {
    let finalUrl = result.url;

    // Step 1: Get image as buffer (from data URI or fetch URL)
    let imgBuffer: Buffer | null = null;
    try {
      if (finalUrl.startsWith('data:')) {
        const b64 = finalUrl.replace(/^data:[^;]+;base64,/, '');
        imgBuffer = Buffer.from(b64, 'base64');
      } else {
        const resp = await fetch(finalUrl);
        if (resp.ok) imgBuffer = Buffer.from(await resp.arrayBuffer());
      }
    } catch (e) { console.error('[featured-image] Failed to get image buffer:', e); }

    // Step 2: Resize, overlay title text, and compress with sharp
    if (imgBuffer) {
      try {
        const mod = 'sharp';
        const sharp = (await import(/* webpackIgnore: true */ mod)).default;
        const originalSize = imgBuffer.length;

        // Resize to standard featured image dimensions
        let pipeline = sharp(imgBuffer).resize({ width: 1200, height: 675, fit: 'cover', withoutEnlargement: false });

        // Overlay article title text if provided
        if (title) {
          const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
          // Word-wrap title to ~30 chars per line
          const words = escapedTitle.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          for (const word of words) {
            if ((currentLine + ' ' + word).trim().length > 30 && currentLine) {
              lines.push(currentLine.trim());
              currentLine = word;
            } else {
              currentLine = (currentLine + ' ' + word).trim();
            }
          }
          if (currentLine) lines.push(currentLine.trim());

          const fontSize = lines.length > 3 ? 36 : 42;
          const lineHeight = fontSize * 1.3;
          const textBlockHeight = lines.length * lineHeight;
          const yStart = (675 - textBlockHeight) / 2;

          const tspans = lines.map((line, i) =>
            `<tspan x="600" dy="${i === 0 ? 0 : lineHeight}" text-anchor="middle">${line}</tspan>`
          ).join('');

          const svgOverlay = Buffer.from(`
            <svg width="1200" height="675">
              <rect x="0" y="0" width="1200" height="675" fill="rgba(0,0,0,0.45)" rx="0"/>
              <text x="600" y="${yStart + fontSize}" font-family="Georgia, serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
                ${tspans}
              </text>
            </svg>
          `);

          pipeline = pipeline.composite([{ input: svgOverlay, top: 0, left: 0 }]);
          console.log(`[featured-image] Title overlay applied: "${title.slice(0, 50)}..."`);
        }

        const compressed = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
        finalUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
        console.log(`[featured-image] Processed: ${Math.round(originalSize/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
      } catch (e) { console.error('[featured-image] Processing failed, using raw:', e); }
    }

    return NextResponse.json({
      image: finalUrl,
      prompt: imagePrompt,
      provider: result.provider,
      model: result.model,
    });
  }

    return NextResponse.json({ image: null, placeholder: true, prompt: imagePrompt, message: "Image generation unavailable." }, { status: 502 });
  } catch (error) {
    console.error("[generate/image] Featured image generation error:", error);
    return NextResponse.json({ image: null, placeholder: true, message: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}

function generateImagePrompt(title: string, category: string, style: string): string {
  const categoryPrompts: Record<string, string> = {
    "protein-powders": "premium protein powder scoops, mixing shaker bottle with protein shake, clean white background, sports nutrition aesthetic, powder texture close-up, athletic performance theme",
    "amino-acids": "molecular structure diagram showing amino acid chains, supplement capsules arranged artistically, laboratory professional aesthetic, health science visualization",
    "pre-workout": "energetic pre-workout supplement powder, dynamic sports scene, athlete in motion, supplement scoop with vibrant colored powder, high-energy athletic performance theme",
    "bcaa": "branched chain amino acid supplement capsules, clean laboratory setup, scientific nutritional supplements arrangement, professional healthcare aesthetic",
    "creatine": "creatine monohydrate powder with measuring spoon, sports science equipment, clean neutral background, supplement quality close-up, athletic performance focus",
    "vitamins-minerals": "colorful assorted vitamin capsules and tablets, clean arrangement on white background, nutritional supplement variety, health and wellness theme",
    "fat-burners": "thermogenic supplement arrangement, modern supplement bottles, clean minimalist presentation, health optimization aesthetic, professional supplement layout",
    "testosterone-support": "supplement bottle with herbal botanical imagery, natural ingredients visualization, masculine wellness theme, professional supplement presentation",
    "sleep-recovery": "supplement capsules arranged peacefully, calming evening atmosphere, recovery and rest theme, professional sleep supplement presentation, ambient soft lighting",
    "digestive-health": "digestive enzyme supplement capsules, gut health visualization, professional nutritional supplement aesthetic, clean white background",
    "general-supplements": "assorted premium supplements and vitamins, clean minimalist arrangement, professional supplement aesthetic, nutrition science theme, premium editorial quality",
  };

  const basePrompt = categoryPrompts[category] || categoryPrompts["general-supplements"];
  const styleModifier = style === "photorealistic"
    ? "professional photography, high quality, realistic, editorial style"
    : "artistic illustration, modern graphic design, clean lines";

  return `${basePrompt}, inspired by the topic "${title}", ${styleModifier}, absolutely no text, no words, no letters, no logos, no watermarks, no writing of any kind, supplement and sports nutrition theme, premium editorial quality, soft natural lighting`;
}
