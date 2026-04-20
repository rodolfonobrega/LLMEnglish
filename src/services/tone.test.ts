import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./runtimeConfigSnapshot', () => ({
  getConversationTone: vi.fn(() => 'balanced'),
}));

import { resolveContextualTone } from './tone';
import { getConversationTone } from './runtimeConfigSnapshot';

describe('resolveContextualTone', () => {
  beforeEach(() => {
    vi.mocked(getConversationTone).mockReturnValue('balanced');
  });

  it('prioritises explicit override above everything else', () => {
    expect(
      resolveContextualTone({
        kind: 'live-roleplay',
        override: 'formal',
        card: { type: 'roleplay', context: 'casual bar chat with friends' },
      }),
    ).toBe('formal');
  });

  it('uses formal hints from contentHints', () => {
    expect(
      resolveContextualTone({
        kind: 'lesson',
        contentHints: ['job interview with the CEO'],
      }),
    ).toBe('formal');
  });

  it('uses casual hints from card context', () => {
    expect(
      resolveContextualTone({
        kind: 'solo-roleplay',
        card: { type: 'roleplay', context: 'catching up with a friend' },
      }),
    ).toBe('casual');
  });

  it('falls back to card-type heuristic for image when global is balanced', () => {
    expect(
      resolveContextualTone({
        kind: 'image',
        card: { type: 'image' },
      }),
    ).toBe('casual');
  });

  it('keeps a non-balanced global preference intact', () => {
    vi.mocked(getConversationTone).mockReturnValue('formal');
    expect(
      resolveContextualTone({
        kind: 'image',
        card: { type: 'image' },
      }),
    ).toBe('formal');
  });

  it('falls back to the global tone when no hints or overrides apply', () => {
    vi.mocked(getConversationTone).mockReturnValue('casual');
    expect(
      resolveContextualTone({
        kind: 'solo-phrase',
        card: { type: 'phrase' },
      }),
    ).toBe('casual');
  });
});
