import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from './useAudioRecorder';

const { blobToBase64Mock } = vi.hoisted(() => ({
  blobToBase64Mock: vi.fn().mockResolvedValue('base64data'),
}));

vi.mock('../utils/audio', () => ({
  blobToBase64: blobToBase64Mock,
}));

class FakeMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);
  state = 'inactive';
  stream: MediaStream;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream);

beforeEach(() => {
  vi.clearAllMocks();
  FakeMediaRecorder.isTypeSupported.mockReturnValue(true);
  blobToBase64Mock.mockResolvedValue('base64data');
  mockGetUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream);

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    },
    writable: true,
  });

  Object.defineProperty(globalThis, 'MediaRecorder', {
    value: FakeMediaRecorder,
    writable: true,
  });

  Object.defineProperty(globalThis.URL, 'createObjectURL', {
    value: vi.fn().mockReturnValue('blob:mock-url'),
    writable: true,
  });

  Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
    value: vi.fn(),
    writable: true,
  });
});

describe('useAudioRecorder', () => {
  it('records audio and produces blob, url, and base64', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.audioBlob).toBeInstanceOf(Blob);
    expect(result.current.audioUrl).toBe('blob:mock-url');
    expect(result.current.audioBase64).toBe('base64data');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('revokes previous URL when starting a new recording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    // First recording
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      result.current.stopRecording();
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const firstUrl = 'blob:mock-url';

    // Reset for second recording to generate a different URL
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-url-2');

    // Second recording - should revoke old URL
    await act(async () => {
      await result.current.startRecording();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
  });

  it('revokes URL on unmount', async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
    });

    const url = result.current.audioUrl;
    expect(url).toBeTruthy();

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('stops active mediaRecorder on unmount while recording', async () => {
    const stopSpy = vi.spyOn(FakeMediaRecorder.prototype, 'stop');

    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    unmount();

    // The cleanup should have called stop on the recorder
    expect(stopSpy).toHaveBeenCalled();
  });

  it('discardRecording revokes URL and clears state', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      result.current.stopRecording();
    });

    expect(result.current.audioUrl).toBe('blob:mock-url');

    act(() => {
      result.current.discardRecording();
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.audioUrl).toBeNull();
    expect(result.current.audioBase64).toBeNull();
  });

  it('falls back to audio/webm when opus codec not supported', async () => {
    FakeMediaRecorder.isTypeSupported.mockReturnValue(false);

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(FakeMediaRecorder.isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus');
  });

  it('stopRecording stops stream tracks as safety net', async () => {
    const trackStop = vi.fn();
    mockGetUserMedia.mockResolvedValueOnce({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      result.current.stopRecording();
    });

    // Stream tracks should be stopped as safety net
    expect(trackStop).toHaveBeenCalled();
  });
});
