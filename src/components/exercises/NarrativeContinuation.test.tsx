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

const responses = [
  JSON.stringify({
    opening_sentences: 'It was just before sunrise when...',
    suggested_topic: 'sunrise',
  }),
  JSON.stringify({
    score: 7.5,
    scores5d: {
      naturalness: 75,
      accuracy: 80,
      fluency: 70,
      pragmatics: 78,
      completeness: 85,
    },
    primaryDimension: 'fluency',
    corrections: [],
    correctedVersion: '',
  }),
];

const chatCompletionMock = vi.fn().mockImplementation(() => {
  const next = responses.shift();
  return Promise.resolve(next ?? responses[responses.length - 1] ?? '{}');
});

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi
    .fn()
    .mockResolvedValue('Then he opened the door and went outside. The sky was pink.'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/errorAnalysis', () => ({
  recordErrorPatterns: vi.fn().mockResolvedValue(undefined),
}));

import { NarrativeContinuation } from './NarrativeContinuation';

describe('NarrativeContinuation', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and shows the round container while generating', () => {
    render(<NarrativeContinuation />);
    expect(screen.getByTestId('narrative-round')).toBeInTheDocument();
  });

  it('calls chatCompletion with a narrative system prompt on mount', async () => {
    render(<NarrativeContinuation />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
    const firstCallArgs = chatCompletionMock.mock.calls[0];
    const systemPrompt = String(firstCallArgs[0] ?? '');
    expect(systemPrompt.toLowerCase()).toContain('narrative');
  });
});
