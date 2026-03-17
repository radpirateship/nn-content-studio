/**
 * Shared Image Generation Utility
 * Uses Gemini 3.1 Flash Image via Google AI Studio
 */

export type ImageModel = 'gemini-3.1-flash-image-preview';

export const IMAGE_MODEL_LABELS: Record<ImageModel, string> = {
  'gemini-3.1-flash-image-preview': 'Gemini',
};

export const IMAGE_MODEL_DESCRIPTIONS: Record<ImageModel, string> = {
  'gemini-3.1-flash-image-preview': 'Gemini 3.1 Flash Image',
};

export const IMAGE_MODELS: ImageModel[] = ['gemini-3.1-flash-image-preview'];

export interface GeneratedImageResult {
  url: string;
  model: ImageModel;
  provider: string;
}

export async function generateImageWithModel(
  prompt: string,
  model: ImageModel,
  options?: {
    style?: string;
    imageSize?: string;
    aspectRatio?: string;
  }
): Promise<GeneratedImageResult | null> {
  return generateWithGemini(prompt, options?.aspectRatio || '16:9');
}

async function generateWithGemini(
  prompt: string,
  aspectRatio: string
): Promise<GeneratedImageResult | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('[imageGeneration] GEMINI_API_KEY not set');
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Generate an image based on this description. Do not include any text overlays unless specifically requested.\n\n${prompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  console.log('[imageGeneration] Gemini request, prompt length:', prompt.length);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[imageGeneration] Gemini HTTP error:', response.status, errText.slice(0, 500));
      return null;
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      console.error('[imageGeneration] Gemini blocked prompt:', data.promptFeedback.blockReason);
      return null;
    }

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('[imageGeneration] Gemini returned no candidates.');
      return null;
    }

    const finishReason = candidates[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.error('[imageGeneration] Gemini non-STOP finish reason:', finishReason);
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.error('[imageGeneration] Gemini returned no parts.');
      return null;
    }

    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
    if (!imagePart?.inlineData) {
      const partTypes = parts.map((p: { text?: string; inlineData?: unknown }) => p.text ? `text(${p.text.length} chars)` : p.inlineData ? 'image' : 'unknown');
      console.error('[imageGeneration] Gemini returned no image data. Part types:', partTypes);
      return null;
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';

    console.log('[imageGeneration] Gemini raw image size:', Math.round(base64Data.length * 0.75 / 1024), 'KB');

    const dataUri = `data:${mimeType};base64,${base64Data}`;
    return { url: dataUri, model: 'gemini-3.1-flash-image-preview', provider: 'gemini-3.1-flash-image-preview' };
  } catch (error) {
    console.error('[imageGeneration] Gemini exception:', error instanceof Error ? error.message : error);
    return null;
  }
}
