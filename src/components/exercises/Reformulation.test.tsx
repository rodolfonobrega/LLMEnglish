import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../hooks/useTTS', () => ({
  useTTS: () => ({ speak: vi.fn(), isLoading: false }),
}));

const mockRecorder = {
  isRecording: false,
  audioBlob: null as Blob | null,
  audioUrl: null,
  audioBase64: null,
  error: null,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  discardRecording: vi.fn(),
};

vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => mockRecorder,
}));

// chatCompletion is called at least twice per round: first for generation
// (reformulation prompt), then for evaluation (5D scorecard). The queue lets
// each call return a different payload while keeping the mock simple.
const responses: string[] = [
  JSON.stringify({
    source: 'I would like to request an extension for the deadline.',
    target_style: 'more_casual',
    reference_examples: ['Hey, any way we could push the deadline?'],
  }),
  JSON.stringify({
    score: 8,
    scores5d: {
      naturalness: 80,
      accuracy: 85,
      fluency: 78,
      pragmatics: 82,
      completeness: 90,
    },
    primaryDimension: 'naturalness',
    corrections: [],
    correctedVersion: 'Hey, any way we could push the deadline?',
    betterAlternatives: [],
    highlights: [],
    overallFeedback: 'ok',
  }),
];

const chatCompletionMock = vi
  .fn()
  .mockImplementation(() => Promise.resolve(responses.shift() ?? '{}'));

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('hey any way we could push the deadline'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/errorAnalysis', () => ({
  recordErrorPatterns: vi.fn().mockResolvedValue(undefined),
}));

import { Reformulation } from './Reformulation';

describe('Reformulation', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and shows the round container while generating', () => {
    render(<Reformulation />);
    expect(screen.getByTestId('reformulation-round')).toBeInTheDocument();
  });

  it('calls chatCompletion via the reformulation prompt helper on mount', async () => {
    render(<Reformulation />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
    const firstCallArgs = chatCompletionMock.mock.calls[0];
    const systemPrompt = String(firstCallArgs[0] ?? '');
    expect(systemPrompt.toLowerCase()).toContain('reformulation');
  });
});
