#!/usr/bin/env node
/**
 * Generate practice mode images with the correct landscape aspect ratio
 * using Google Gemini API (native image generation).
 *
 * Usage:
 *   node scripts/generate-mode-images.mjs              # generate all 7
 *   node scripts/generate-mode-images.mjs phrases       # generate one
 *   MODEL=gemini-2.0-flash node scripts/generate-mode-images.mjs  # custom model
 *
 * Reads VITE_GEMINI_API_KEY from .env.local automatically.
 * Or pass GEMINI_API_KEY env var directly.
 *
 * Outputs 16:9 landscape PNGs to public/images/modes/
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public', 'images', 'modes');

const MODEL = process.env.MODEL || 'gemini-3.1-flash-image-preview';

const BASE_STYLE =
  'Warm, inviting illustration in a soft anime/cartoon style inspired by Studio Ghibli. Cozy atmosphere with soft natural lighting, warm but NOT amber or sepia-toned. Color palette includes wood browns, leafy greens, warm cream, soft pink, muted teal, and gentle orange accents. Maintain natural color variety -- each object should have its own distinct color. Gentle bokeh effects in the background. Visible but soft linework, no detailed faces on people. Clean composition, no text overlays, no writing or letters anywhere in the image. Wide landscape composition.';

const MODE_PROMPTS = {
  phrases: `${BASE_STYLE} A young person sitting at a cozy wooden desk in a warm study room, speaking out loud with gentle speech bubbles floating around their head. The speech bubbles contain abstract flowing shapes (no text). The person is gesturing expressively while practicing speaking. A warm cup of tea on the desk, potted plants on the windowsill, soft afternoon light streaming through lace curtains. The scene conveys the joy of learning to express yourself in a new language.`,

  texts: `${BASE_STYLE} A cozy reading nook with a person reading aloud from an open book on a wooden table. Next to the book sits a vintage-style microphone, suggesting pronunciation practice. A steaming mug of coffee nearby. The book has colorful bookmark ribbons. Bookshelves in the background filled with colorful books, a hanging plant, warm pendant lamp overhead. Soft natural light from a window. The atmosphere is focused yet comfortable, perfect for reading and speaking practice.`,

  situations: `${BASE_STYLE} A split-scene illustration showing everyday real-life situations: on the left, a person ordering at a restaurant counter; on the right, a person asking for directions at a street corner with a map. Both scenes flow together in one wide panoramic composition. Warm outdoor lighting, cobblestone streets, café awnings, a fountain in the middle distance. Small details like a bicycle, a dog on a leash, flower boxes on windows. The composition shows the variety of real-world scenarios where language skills matter.`,

  scripts: `${BASE_STYLE} A charming theater stage scene with two performers in costume acting out a dialogue. Red velvet curtains frame the stage on both sides. A wooden stage floor with warm spotlighting. One character gestures dramatically while the other listens attentively. In the background, painted scenery of a cozy interior. A small script booklet lies open on the stage floor. The atmosphere is playful and creative, capturing the joy of acting and role-playing.`,

  simulation: `${BASE_STYLE} Two people engaged in a warm, animated conversation at a cozy café. They sit across from each other at a rustic wooden table with coffee cups and a small pastry plate. One person is speaking with expressive hand gestures, the other is smiling and listening. The café has exposed brick walls, hanging pendant lights, bookshelves, and large windows showing a pleasant evening outside with soft street lights. Rain droplets on the window glass. The mood is friendly and immersive, like a real conversation.`,

  visual: `${BASE_STYLE} A vintage camera on a wooden table, its large lens displaying a vibrant garden scene with a cottage, colorful flowers, and butterflies. Surrounding the camera: a magnifying glass, an open botanical sketchbook with colorful illustrations of plants, colored pencils, and a small potted succulent. A window in the background shows a lush garden outside. Warm afternoon light creates soft shadows. The scene invites close observation and description, capturing the essence of looking carefully and putting what you see into words.`,

  trails: `${BASE_STYLE} A winding scenic path through a diverse landscape representing a journey of learning. The path starts from a cozy study room in the foreground, passes through a bustling market square in the middle, and leads toward a sunlit mountain vista in the distance. Along the path: signposts (no text), a small bridge over a stream, colorful wildflowers, a compass on the ground. The wide panoramic composition shows the entire journey from start to finish, with morning light creating a sense of adventure and discovery.`,
};

function readEnvKey(envFile) {
  const envPath = resolve(PROJECT_ROOT, envFile);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    const match = content.match(/VITE_GEMINI_API_KEY\s*=\s*["']?([^"'\n]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

async function getApiKey() {
  // 1. Explicit env var
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  // 2. Try .env.local then .env
  return readEnvKey('.env.local') || readEnvKey('.env') || (() => {
    console.error('No API key found. Set GEMINI_API_KEY or add VITE_GEMINI_API_KEY to .env / .env.local');
    process.exit(1);
  })();
}

async function generateImage(apiKey, mode, prompt) {
  const isImagen = MODEL.startsWith('imagen-');

  let url, body;

  if (isImagen) {
    // Imagen predict endpoint — supports aspectRatio
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`;
    body = {
      instances: [{ prompt }],
      parameters: {
        aspectRatio: '16:9',
        personGeneration: 'allow_adult',
        numberOfImages: 1,
      },
    };
  } else {
    // Gemini generateContent endpoint (for models that support native image gen)
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    body = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        imageConfig: {
          aspectRatio: '21:9',
          imageSize: '1K',
        },
      },
    };
  }

  console.log(`  Generating ${mode} with ${MODEL}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error for ${mode} (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let buffer = null;

  if (isImagen) {
    // Imagen predict returns predictions[].bytesBase64
    const bytesBase64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!bytesBase64) {
      throw new Error(`No image in Imagen response for ${mode}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    buffer = Buffer.from(bytesBase64, 'base64');
  } else {
    // Gemini generateContent returns candidates[].content.parts[].inlineData
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error(`No parts in Gemini response for ${mode}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    for (const part of parts) {
      if (part.inlineData) {
        buffer = Buffer.from(part.inlineData.data, 'base64');
        break;
      }
    }
    if (!buffer) {
      throw new Error(`No image data in Gemini response for ${mode}. Parts: ${JSON.stringify(parts).slice(0, 300)}`);
    }
  }

  const outputPath = resolve(OUTPUT_DIR, `${mode}.png`);
  writeFileSync(outputPath, buffer);
  console.log(`  Saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
}

async function main() {
  const mode = process.argv[2];

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const apiKey = await getApiKey();

  const modes = mode
    ? [mode]
    : Object.keys(MODE_PROMPTS);

  console.log(`\nGenerating ${modes.length} mode image(s) with ${MODEL} (16:9 landscape)...\n`);

  let failed = 0;

  for (const m of modes) {
    if (!MODE_PROMPTS[m]) {
      console.error(`  Unknown mode: ${m}. Available: ${Object.keys(MODE_PROMPTS).join(', ')}`);
      failed++;
      continue;
    }

    try {
      await generateImage(apiKey, m, MODE_PROMPTS[m]);
    } catch (err) {
      console.error(`  FAILED ${m}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! ${modes.length - failed}/${modes.length} images generated.`);

  if (failed > 0) process.exit(1);
}

main();
