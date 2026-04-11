import { useState, useRef, useCallback, useEffect } from 'react';
import { blobToBase64 } from '../utils/audio';

export interface AudioRecorderState {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioBase64: string | null;
  error: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    audioBase64: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);

  const updateState = useCallback((updater: AudioRecorderState | ((prev: AudioRecorderState) => AudioRecorderState)) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      audioUrlRef.current = next.audioUrl;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Revoke previous blob URL if user re-records
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        isRecordingRef.current = false;
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        updateState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob: blob,
          audioUrl: url,
          audioBase64: base64,
        }));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      isRecordingRef.current = true;
      updateState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (err) {
      updateState(prev => ({
        ...prev,
        error: `Microphone access denied: ${err}`,
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      // Safety net: stop stream tracks immediately in case onstop doesn't fire
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      mediaRecorderRef.current.stop();
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    updateState({
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      audioBase64: null,
      error: null,
    });
  }, [state.audioUrl, updateState]);

  return {
    ...state,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
