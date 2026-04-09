/**
 * Image Generation Configuration
 *
 * Configure image generation parameters for different contexts in the app.
 *
 * IMPORTANT: OpenAI and Google use DIFFERENT parameters!
 *
 * OpenAI GPT Image uses: size, quality, format, compression, background, moderation
 * Google Imagen uses: aspectRatio, imageSize, personGeneration, numberOfImages
 *
 * The service layer automatically picks the correct parameters based on your
 * provider selection in Settings. Unsupported parameters are simply ignored.
 */

import { getModelConfig as getModelConfigImport } from '../services/storage';

// ─── OpenAI GPT Image Parameters ─────────────────────────────────────────────
// For: gpt-image-1.5, gpt-image-1, gpt-image-1-mini
//
// size:           'auto' | '1024x1024' | '1536x1024' | '1024x1536'
// quality:        'auto' | 'low' | 'medium' | 'high'
// format:         'png' | 'jpeg' | 'webp'
// compression:    0-100 (JPEG/WebP only)
// background:     'opaque' | 'transparent' (PNG/WebP only)
// moderation:     'auto' | 'low'

// ─── Google Imagen Parameters ─────────────────────────────────────────────────
// For: imagen-4.0-generate-001, imagen-4.0-ultra-generate-001, etc.
//
// aspectRatio:        '1:1' (default) | '3:4' | '4:3' | '9:16' | '16:9'
// imageSize:          '1K' (default) | '2K' (Standard/Ultra only)
// personGeneration:   'allow_adult' (default) | 'allow_all' | 'dont_allow'
// numberOfImages:     1-4 (we only use the first)

// ─── Image Configuration per Context ────────────────────────────────────────

export const BASE_IMAGE_STYLE_PROMPT =
  "Warm, inviting illustration in a soft anime/cartoon style inspired by Studio Ghibli. Cozy atmosphere with soft natural lighting, warm but NOT amber or sepia-toned. Color palette includes wood browns, leafy greens, warm cream, soft pink, muted teal, and gentle orange accents. Maintain natural color variety -- each object should have its own distinct color. Gentle bokeh effects in the background. Visible but soft linework, no detailed faces on people. Clean composition, no text overlays. ";

export const IMAGE_CONFIG = {
  /**
   * Image Mode - Discovery page
   * Generates everyday scenes for English description practice.
   */
  imageMode: {
    // ── OpenAI (GPT Image) ────────────────────────────────────
    openai: {
      size: '1024x1024',
      quality: 'medium',
      format: 'jpeg',
      compression: 80,
      background: 'opaque',
      moderation: 'auto',
    },

    // ── Google (Imagen) ────────────────────────────────────────
    gemini: {
      aspectRatio: '1:1',      // Square
      imageSize: '1K',
      personGeneration: 'allow_adult',
    },
  },

  /**
   * Exercise Mode - Mixed exercises
   * Generates images when image type is selected.
   */
  exerciseMode: {
    // ── OpenAI (GPT Image) ────────────────────────────────────
    openai: {
      size: '1024x1024',
      quality: 'medium',
      format: 'jpeg',
      compression: 80,
      background: 'opaque',
      moderation: 'auto',
    },

    // ── Google (Imagen) ────────────────────────────────────────
    gemini: {
      aspectRatio: '1:1',
      imageSize: '1K',
      personGeneration: 'allow_adult',
    },
  },

  /**
   * Scenario Thumbnails - Live Roleplay
   * Generates illustrations/thumbnails for roleplay scenarios.
   */
  scenarioThumbnail: {
    // ── OpenAI (GPT Image) ────────────────────────────────────
    openai: {
      size: '1536x1024',       // Landscape
      quality: 'low',          // Faster for thumbnails
      format: 'jpeg',          // Smaller file size
      compression: 85,
      background: 'opaque',
      moderation: 'auto',
    },

    // ── Google (Imagen) ────────────────────────────────────────
    gemini: {
      aspectRatio: '16:9',     // Widescreen
      imageSize: '1K',         // Sufficient for thumbnails
      personGeneration: 'allow_adult',
    },
  },

} as const;

// ─── Type Exports ───────────────────────────────────────────────────────────

export type ImageContext = keyof typeof IMAGE_CONFIG;

// OpenAI options
export type OpenAIImageOptions = {
  size?: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  quality?: 'auto' | 'low' | 'medium' | 'high';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number;
  background?: 'opaque' | 'transparent';
  moderation?: 'auto' | 'low';
};

// Imagen options
export type ImagenImageOptions = {
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize?: '1K' | '2K';
  personGeneration?: 'allow_adult' | 'allow_all' | 'dont_allow';
  numberOfImages?: number;
};

// Combined options (for type compatibility)
export type ImageOptions = OpenAIImageOptions & ImagenImageOptions;

/**
 * Get image configuration for a specific context and source.
 *
 * @param context - The context (imageMode, exerciseMode, scenarioThumbnail)
 * @param source - The source ('genai'/'vertex' for Gemini, or 'openai'/'openrouter' for OpenAI)
 *
 * @example
 * getImageConfig('imageMode', 'openai')     // Returns OpenAI config
 * getImageConfig('scenarioThumbnail', 'genai')  // Returns Imagen config
 */
export function getImageConfig(
  context: ImageContext,
  source: 'genai' | 'vertex' | 'openai' | 'openrouter'
): ImageOptions {
  const config = IMAGE_CONFIG[context];
  const isGemini = source === 'genai' || source === 'vertex';
  return isGemini ? { ...config.gemini } : { ...config.openai };
}

/**
 * Get image configuration for a context, using the currently configured provider.
 * This helper reads the provider from localStorage automatically.
 *
 * @param context - The context (imageMode, exerciseMode, scenarioThumbnail)
 *
 * @example
 * getImageConfigAuto('imageMode')  // Automatically uses configured provider
 */
export function getImageConfigAuto(context: ImageContext): ImageOptions {
  const config = getModelConfigImport();
  return getImageConfig(context, config.imageSource);
}
