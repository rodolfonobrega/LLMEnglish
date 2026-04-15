import { describe, expect, it } from 'vitest';
import { IMAGE_CONFIG, getImageConfig } from './images';

describe('IMAGE_CONFIG', () => {
  describe('imageMode.openai', () => {
    it('uses PNG format', () => {
      expect(IMAGE_CONFIG.imageMode.openai.format).toBe('png');
    });

    it('has no compression (PNG)', () => {
      expect(IMAGE_CONFIG.imageMode.openai.compression).toBeUndefined();
    });
  });

  describe('exerciseMode.openai', () => {
    it('uses PNG format', () => {
      expect(IMAGE_CONFIG.exerciseMode.openai.format).toBe('png');
    });

    it('has no compression (PNG)', () => {
      expect(IMAGE_CONFIG.exerciseMode.openai.compression).toBeUndefined();
    });
  });

  describe('scenarioThumbnail.openai', () => {
    it('uses JPEG format', () => {
      expect(IMAGE_CONFIG.scenarioThumbnail.openai.format).toBe('jpeg');
    });

    it('uses compression 85', () => {
      expect(IMAGE_CONFIG.scenarioThumbnail.openai.compression).toBe(85);
    });
  });

  describe('gemini configs', () => {
    it('all gemini configs have aspectRatio defined', () => {
      expect(IMAGE_CONFIG.imageMode.gemini.aspectRatio).toBeDefined();
      expect(IMAGE_CONFIG.exerciseMode.gemini.aspectRatio).toBeDefined();
      expect(IMAGE_CONFIG.scenarioThumbnail.gemini.aspectRatio).toBeDefined();
    });
  });
});

describe('getImageConfig', () => {
  it('returns openai config for imageMode with openai source', () => {
    const config = getImageConfig('imageMode', 'openai');
    expect(config.format).toBe('png');
    expect(config.quality).toBe('medium');
  });

  it('returns gemini config for imageMode with genai source', () => {
    const config = getImageConfig('imageMode', 'genai');
    expect(config.aspectRatio).toBe('1:1');
  });

  it('returns gemini config for scenarioThumbnail with genai source', () => {
    const config = getImageConfig('scenarioThumbnail', 'genai');
    expect(config.aspectRatio).toBe('16:9');
  });
});
