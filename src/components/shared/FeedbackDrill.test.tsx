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

vi.mock('../../services/openai', () => ({
  speechToText: vi.fn().mockResolvedValue('I went to the store yesterday'),
}));

import { FeedbackDrill } from './FeedbackDrill';

describe('FeedbackDrill', () => {
  beforeEach(() => {
    mockRecorder.isRecording = false;
    mockRecorder.audioBlob = null;
    mockRecorder.startRecording.mockReset();
    mockRecorder.stopRecording.mockReset();
    mockRecorder.discardRecording.mockReset();
  });

  it('renders the target sentence', () => {
    render(<FeedbackDrill target="I went to the store" />);
    expect(screen.getByText('I went to the store')).toBeInTheDocument();
  });

  it('renders the original attempt as context when provided', () => {
    render(<FeedbackDrill target="I went to the store" original="I goed to store" />);
    expect(screen.getByText(/I goed to store/)).toBeInTheDocument();
  });

  it('shows the Tentar falar CTA when idle', () => {
    render(<FeedbackDrill target="I went to the store" />);
    expect(screen.getByRole('button', { name: /tentar falar/i })).toBeInTheDocument();
  });

  it('swaps the CTA for Parar while recording', () => {
    mockRecorder.isRecording = true;
    render(<FeedbackDrill target="I went to the store" />);
    expect(screen.getByRole('button', { name: /parar/i })).toBeInTheDocument();
  });
});
