/**
 * Shared Image Generation Utility
 * Uses Gemini 3.1 Flash Image via Google AI Studio
 *
 * Updated: 2026-03-22 — added request timeouts and retry with backoff
 */

import { withRetry } from './retry';

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

const GEMINI_TIMEOUT_MS = 60_000; // 60 seconds per request

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

  // Retry wrapper: retries on 5xx, 429, and network errors (not content-policy blocks)
  return withRetry(async () => {
    // Per-attempt timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
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

        let message = providerMessage || `Gemini image generation failed (status: ${response.status}).`;
        if (response.status === 429) {
          message = 'Gemini rate limit reached (status: 429). Wait a minute and try again.';
        } else if (response.status === 503 || providerStatus === 'UNAVAILABLE') {
          message = 'Gemini image generation is temporarily unavailable (status: 503). Please try again in a minute.';
        } else if (response.status >= 500) {
          message = `Gemini image service error (status: ${response.status}). Please try again shortly.`;
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
        // Content policy blocks are NOT retryable — same prompt will always fail
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
      return { url: dataUri, model: 'gemini-3.1-flash-image-preview' as ImageModel, provider: 'gemini-3.1-flash-image-preview' };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ImageGenerationError(
          `Gemini image generation timed out after ${Math.round(GEMINI_TIMEOUT_MS / 1000)}s. Try a simpler prompt.`
        );
      }
      if (error instanceof ImageGenerationError) throw error;
      console.error('[imageGeneration] Gemini exception:', error instanceof Error ? error.message : error);
      throw new ImageGenerationError(
        error instanceof Error ? error.message : 'Unexpected image generation error.'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }, {
    label: 'Gemini',
    maxRetries: 2,
    isRetryable: (err) => {
      // Don't retry content-policy blocks or "no candidates" — same prompt will fail again
      if (err instanceof ImageGenerationError) {
        if (err.message.includes('blocked this prompt')) return false;
        if (err.message.includes('no image candidates')) return false;
        if (err.message.includes('without image data')) return false;
        // Retry rate limits, 5xx, timeouts, network errors
        if (err.code && (err.code >= 500 || err.code === 429)) return true;
        if (err.message.includes('timed out')) return true;
      }
      // Fall back to generic transient error check
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return msg.includes('network') || msg.includes('timeout') || msg.includes('fetch failed');
      }
      return false;
    },
  });
}
