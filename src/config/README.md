# Configuration Files

This directory contains configuration files that are easy to edit without touching the main code.

## Image Configuration (`images.ts`)

Configure image generation parameters for different contexts in the app.

### How to Use

Open `src/config/images.ts` and edit the values you want to change.

### Available Contexts

| Context | Where It's Used | Default Settings |
|---------|----------------|------------------|
| `imageMode` | Discovery page → Image Challenge (everyday scenes) | Square 1:1, medium quality, PNG |
| `exerciseMode` | Discovery page → Exercise → Visual Prompt | Square 1:1, medium quality, PNG |
| `scenarioThumbnail` | Live Roleplay → Scenario thumbnails | Widescreen 16:9, low quality, JPEG |

---

## OpenAI GPT Image Parameters

For models: `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`

| Parameter | Type | Description |
|-----------|------|-------------|
| `size` | `'auto'` \| `'1024x1024'` \| `'1536x1024'` \| `'1024x1536'` | Image dimensions |
| `quality` | `'auto'` \| `'low'` \| `'medium'` \| `'high'` | Rendering quality |
| `format` | `'png'` \| `'jpeg'` \| `'webp'` | File format |
| `compression` | `0-100` | Compression level (JPEG/WebP only) |
| `background` | `'opaque'` \| `'transparent'` | Background type (PNG/WebP only) |
| `moderation` | `'auto'` \| `'low'` | Content moderation level |

### Cost Optimization (OpenAI)

| Quality | Square (1024×1024) | Landscape (1536×1024) | Portrait (1024×1536) |
|---------|-------------------|----------------------|---------------------|
| Low | ~272 tokens | ~400 tokens | ~408 tokens |
| Medium | ~1056 tokens | ~1568 tokens | ~1584 tokens |
| High | ~4160 tokens | ~6208 tokens | ~6240 tokens |

Source: [OpenAI Image Generation](https://developers.openai.com/api/docs/guides/image-generation)

---

## Google Imagen Parameters

For models: `imagen-4.0-generate-001`, `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001`

| Parameter | Type | Description |
|-----------|------|-------------|
| `aspectRatio` | `'1:1'` \| `'3:4'` \| `'4:3'` \| `'9:16'` \| `'16:9'` | Aspect ratio (default: `'1:1'`) |
| `imageSize` | `'1K'` \| `'2K'` | Resolution (Standard/Ultra models only, default: `'1K'`) |
| `personGeneration` | `'allow_adult'` \| `'allow_all'` \| `'dont_allow'` | Allow people in images (default: `'allow_adult'`) |
| `numberOfImages` | `1-4` | Number of images to generate (we only use the first) |

### Aspect Ratio Guide

| Ratio | Description | Use Cases |
|-------|-------------|-----------|
| `1:1` | Square (default) | Social media posts, general use |
| `4:3` | Fullscreen | Photography, film |
| `3:4` | Portrait fullscreen | Tall subjects, portraits |
| `16:9` | Widescreen | Landscapes, thumbnails, backgrounds |
| `9:16` | Portrait | Mobile, stories, tall subjects |

Source: [Google Imagen Documentation](https://ai.google.dev/gemini-api/docs/imagen)

---

## Example Configuration

```typescript
export const IMAGE_CONFIG = {
  // High quality for practice images (OpenAI)
  imageMode: {
    // OpenAI parameters
    size: '1536x1024',      // Landscape
    quality: 'high',        // Best quality
    format: 'png',
    background: 'opaque',
    moderation: 'auto',

    // Imagen parameters
    aspectRatio: '16:9',    // Widescreen
    imageSize: '2K',        // Higher resolution
    personGeneration: 'allow_adult',
  },

  // Fast generation for thumbnails (Imagen)
  scenarioThumbnail: {
    // OpenAI parameters
    size: '1536x1024',
    quality: 'low',         // Faster
    format: 'jpeg',         // Smaller file size
    compression: 80,
    background: 'opaque',
    moderation: 'auto',

    // Imagen parameters
    aspectRatio: '16:9',
    imageSize: '1K',        // Faster, sufficient for thumbnails
    personGeneration: 'allow_adult',
  },
};
```

---

## Provider Selection

The image provider is configured in **Settings** page:
- **OpenAI**: Uses `size`, `quality`, `format`, `compression`, `background`, `moderation`
- **Google (Imagen)**: Uses `aspectRatio`, `imageSize`, `personGeneration`, `numberOfImages`

Both providers can use the same configuration file - unused parameters are simply ignored.
