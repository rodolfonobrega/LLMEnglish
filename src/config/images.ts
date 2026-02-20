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
  "A high-quality, modern 2D vector animation style. Vibrant yet warm colors, soft gradient lighting, and a clean, cozy, and inviting aesthetic. Similar to high-end modern game art or Studio Ghibli. No text overlays. ";

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
      format: 'png',
      compression: undefined,
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
      format: 'png',
      compression: undefined,
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
 * Get image configuration for a specific context and provider.
 *
 * @param context - The context (imageMode, exerciseMode, scenarioThumbnail)
 * @param provider - The provider ('openai' or 'gemini')
 *
 * @example
 * getImageConfig('imageMode', 'openai')     // Returns OpenAI config
 * getImageConfig('scenarioThumbnail', 'gemini')  // Returns Imagen config
 */
export function getImageConfig(
  context: ImageContext,
  provider: 'openai' | 'gemini'
): ImageOptions {
  const config = IMAGE_CONFIG[context];
  return provider === 'openai' ? { ...config.openai } : { ...config.gemini };
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
  const provider = config.imageProvider === 'gemini' ? 'gemini' : 'openai';
  return getImageConfig(context, provider);
}
