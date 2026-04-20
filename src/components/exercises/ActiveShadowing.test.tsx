import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../hooks/useTTS', () => ({
  useTTS: () => ({ speak: vi.fn().mockResolvedValue(undefined), isLoading: false }),
}));

const mockRecorder = {
  isRecording: false,
  audioBlob: null as Blob | null,
  audioUrl: null,
  audioBase64: null,
  error: null,
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn(),
  discardRecording: vi.fn(),
};

vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => mockRecorder,
}));

const chatCompletionMock = vi.fn().mockResolvedValue(
  JSON.stringify({
    line: 'Honestly, I kinda think we should just go, you know?',
    context_hint_pt: 'alguém sugerindo sair',
  }),
);

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('honestly I kinda think we should just go you know'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

import { ActiveShadowing } from './ActiveShadowing';

describe('ActiveShadowing', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and shows the round container while generating', () => {
    render(<ActiveShadowing />);
    expect(screen.getByTestId('active-shadowing-round')).toBeInTheDocument();
  });

  it('calls chatCompletion via the shadowing prompt helper on mount', async () => {
    render(<ActiveShadowing />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
  });
});
