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
    passage: 'Look, the thing is, I almost missed my flight this morning.',
    questions: ['What happened?', 'How did it end?'],
    expected_key_points: ['almost missed the flight', 'made it in time'],
    accent_hint: 'us',
  }),
);

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('he almost missed his flight'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/errorAnalysis', () => ({
  recordErrorPatterns: vi.fn().mockResolvedValue(undefined),
}));

import { DirectedListening } from './DirectedListening';

describe('DirectedListening', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts on the passage stage', () => {
    render(<DirectedListening />);
    expect(screen.getByTestId('directed-listening-passage')).toBeInTheDocument();
  });

  it('calls chatCompletion via the listening passage prompt helper on mount', async () => {
    render(<DirectedListening />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
  });
});
