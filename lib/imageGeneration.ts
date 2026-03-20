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

export class ImageGenerationError extends Error {
  code?: number;
  providerStatus?: string;
  providerMessage?: string;

  constructor(message: string, options?: { code?: number; providerStatus?: string; providerMessage?: string }) {
    super(message);
    this.name = "ImageGenerationError";
    this.code = options?.code;
    this.providerStatus = options?.providerStatus;
    this.providerMessage = options?.providerMessage;
  }
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
    throw new ImageGenerationError('GEMINI_API_KEY is not configured on the server.');
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
      let providerStatus: string | undefined;
      let providerMessage: string | undefined;

      try {
        const parsed = JSON.parse(errText);
        providerStatus = parsed?.error?.status;
        providerMessage = parsed?.error?.message;
      } catch {
        providerMessage = errText.slice(0, 300);
      }

      let message = providerMessage || `Gemini image generation failed with HTTP ${response.status}.`;
      if (response.status === 429) {
        message = 'Gemini rate limit reached. Wait a minute and try again.';
      } else if (response.status === 503 || providerStatus === 'UNAVAILABLE') {
        message = 'Gemini image generation is under high demand right now. Please try again in a minute.';
      } else if (response.status >= 500) {
        message = `Gemini image service error (${response.status}). Please try again shortly.`;
      }

      throw new ImageGenerationError(message, {
        code: response.status,
        providerStatus,
        providerMessage,
      });
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      console.error('[imageGeneration] Gemini blocked prompt:', data.promptFeedback.blockReason);
      throw new ImageGenerationError(`Gemini blocked this prompt: ${data.promptFeedback.blockReason}.`);
    }

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('[imageGeneration] Gemini returned no candidates.');
      throw new ImageGenerationError('Gemini returned no image candidates.');
    }

    const finishReason = candidates[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.error('[imageGeneration] Gemini non-STOP finish reason:', finishReason);
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.error('[imageGeneration] Gemini returned no parts.');
      throw new ImageGenerationError('Gemini returned an empty response.');
    }

    const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
    if (!imagePart?.inlineData) {
      const partTypes = parts.map((p: { text?: string; inlineData?: unknown }) => p.text ? `text(${p.text.length} chars)` : p.inlineData ? 'image' : 'unknown');
      console.error('[imageGeneration] Gemini returned no image data. Part types:', partTypes);
      throw new ImageGenerationError('Gemini returned a response without image data.');
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';

    console.log('[imageGeneration] Gemini raw image size:', Math.round(base64Data.length * 0.75 / 1024), 'KB');

    const dataUri = `data:${mimeType};base64,${base64Data}`;
    return { url: dataUri, model: 'gemini-3.1-flash-image-preview', provider: 'gemini-3.1-flash-image-preview' };
  } catch (error) {
    if (error instanceof ImageGenerationError) throw error;
    console.error('[imageGeneration] Gemini exception:', error instanceof Error ? error.message : error);
    throw new ImageGenerationError(
      error instanceof Error ? error.message : 'Unexpected image generation error.'
    );
  }
}
