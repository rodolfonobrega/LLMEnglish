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
    lines: [
      {
        provocation: 'Your friend lost their keys.',
        expected_naturalness_markers: ['oh no', 'did you'],
      },
      {
        provocation: 'Your boss praises your work.',
        expected_naturalness_markers: ['thank you', 'glad'],
      },
    ],
  }),
);

vi.mock('../../services/openai', () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  speechToText: vi.fn().mockResolvedValue('oh no did you check your car'),
}));

vi.mock('../../services/gamification', () => ({
  addXP: vi.fn().mockResolvedValue(undefined),
}));

import { ReactionDrill } from './ReactionDrill';

describe('ReactionDrill', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
    chatCompletionMock.mockClear();
  });

  it('mounts and renders the intro framing on first paint', () => {
    render(<ReactionDrill />);
    expect(screen.getByTestId('reaction-drill-intro')).toBeInTheDocument();
  });

  it('intro explicitly frames the drill as velocity, not grammar', () => {
    render(<ReactionDrill />);
    const intro = screen.getByTestId('reaction-drill-intro');
    expect(intro.textContent ?? '').toContain(
      'drill de velocidade, não teste de gramática',
    );
  });

  it('kicks off line generation via the reaction drill prompt helper on mount', async () => {
    render(<ReactionDrill />);
    await new Promise((r) => setTimeout(r, 0));
    expect(chatCompletionMock).toHaveBeenCalled();
  });
});
