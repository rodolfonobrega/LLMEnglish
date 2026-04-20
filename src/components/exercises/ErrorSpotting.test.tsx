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
    planted_sentence: 'She go to work every day.',
    error_description: 'x',
    correction: 'She goes to work every day.',
    canonical_pattern: 'third_person_singular_s',
  }),
);

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('She goes to work every day'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/errorAnalysis', () => ({
  recordErrorPatterns: vi.fn().mockResolvedValue(undefined),
}));

import { ErrorSpotting } from './ErrorSpotting';

describe('ErrorSpotting', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and shows the round container while generating', () => {
    render(<ErrorSpotting />);
    expect(screen.getByTestId('error-spotting-round')).toBeInTheDocument();
  });

  it('calls chatCompletion via the error spotting prompt helper on mount', async () => {
    render(<ErrorSpotting />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
  });
});
