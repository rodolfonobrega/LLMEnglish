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

const chatCompletionMock = vi.fn().mockResolvedValue(
  JSON.stringify({
    sentence: 'I was reading when my phone rang.',
    blank_token: 'reading',
    canonical_pattern: 'past_continuous_in_interrupted_narrative',
    tts_sentence_with_beep: 'I was *BEEP* when my phone rang.',
  }),
);

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('reading'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/errorAnalysis', () => ({
  recordErrorPatterns: vi.fn().mockResolvedValue(undefined),
}));

import { OralCloze } from './OralCloze';

describe('OralCloze', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and shows the round skeleton while generating', () => {
    render(<OralCloze />);
    expect(screen.getByTestId('oral-cloze-round')).toBeInTheDocument();
  });

  it('calls chatCompletion via the oral cloze prompt helper on mount', async () => {
    render(<OralCloze />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
  });
});
