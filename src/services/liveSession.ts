/**
 * Common interface for Live Roleplay providers.
 * Both OpenAI Realtime and Gemini Live implement this.
 */

export interface LiveSessionCallbacks {
  /** Called with base64 audio chunks from the AI. */
  onAudioResponse: (audioBase64: string) => void;
  /** Called with streamed AI text (transcript delta). */
  onTextResponse: (text: string) => void;
  /** Called when the AI finishes a turn. */
  onTurnComplete: () => void;
  /** Called on errors. */
  onError: (error: string) => void;
  /** Called when connection state changes. */
  onConnectionChange: (connected: boolean) => void;
  /** Called when the user's speech is transcribed (both OpenAI and Gemini). */
  onUserTranscription?: (text: string) => void;
  /** Called when the AI interrupts itself (user started speaking mid-response). */
  onInterrupted?: () => void;
}

export interface ILiveSession {
  connect(systemInstruction: string): Promise<void>;
  startMicrophone(): Promise<void>;
  stopMicrophone(): void;
  sendTextMessage(text: string): void;
  disconnect(): void;
}
