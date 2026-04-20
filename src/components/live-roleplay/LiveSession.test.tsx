import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { LiveScenario } from '../../types/scenario';
import type { LiveSessionCallbacks, ILiveSession } from '../../services/liveSession';

// ---------------------------------------------------------------------------
// Stub all rendering subcomponents so we don't need their DOM details.
// ---------------------------------------------------------------------------
vi.mock('./SceneCard', () => ({
  SceneCard: () => <div data-testid="scene-card-stub">scene</div>,
}));
vi.mock('./MicPanel', () => ({
  MicPanel: () => <div data-testid="mic-panel-stub">mic</div>,
}));
vi.mock('./ChatHistory', () => ({
  ChatHistory: () => <div data-testid="chat-history-stub">chat</div>,
}));
vi.mock('./ActionBar', () => ({
  ActionBar: () => <div data-testid="action-bar-stub">action</div>,
}));

// ---------------------------------------------------------------------------
// Capture callbacks from the LiveSession instantiation so we can fire them
// and capture the mocked disconnect call count.
// ---------------------------------------------------------------------------
const mockDisconnect = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockStartMic = vi.fn().mockResolvedValue(undefined);
const mockStopMic = vi.fn();
const mockSendText = vi.fn();

let capturedCallbacks: LiveSessionCallbacks | null = null;

class FakeGeminiLiveSession implements ILiveSession {
  constructor(callbacks: LiveSessionCallbacks) {
    capturedCallbacks = callbacks;
  }
  connect = mockConnect;
  startMicrophone = mockStartMic;
  stopMicrophone = mockStopMic;
  sendTextMessage = mockSendText;
  disconnect = mockDisconnect;
}

class FakeOpenAIRealtimeLiveSession implements ILiveSession {
  constructor(callbacks: LiveSessionCallbacks) {
    capturedCallbacks = callbacks;
  }
  connect = mockConnect;
  startMicrophone = mockStartMic;
  stopMicrophone = mockStopMic;
  sendTextMessage = mockSendText;
  disconnect = mockDisconnect;
}

// Mock constructors need to be callable with `new`; use `function` (not arrow)
// so the returned value has a prototype that React's effect can invoke.
vi.mock('../../services/geminiLive', () => ({
  GeminiLiveSession: vi.fn(function (this: FakeGeminiLiveSession, cb: LiveSessionCallbacks) {
    const inst = new FakeGeminiLiveSession(cb);
    Object.assign(this, inst);
    return this;
  }),
}));

vi.mock('../../services/openaiRealtimeLive', () => ({
  OpenAIRealtimeLiveSession: vi.fn(function (this: FakeOpenAIRealtimeLiveSession, cb: LiveSessionCallbacks) {
    const inst = new FakeOpenAIRealtimeLiveSession(cb);
    Object.assign(this, inst);
    return this;
  }),
}));

// Runtime config controls which session class is picked.
const mockGetRuntimeModelConfig = vi.fn();
vi.mock('../../contexts/RuntimeConfigContext', () => ({
  useRuntimeConfig: () => ({ modelConfig: mockGetRuntimeModelConfig() }),
}));

// Import AFTER mocks are registered.
import { LiveSession } from './LiveSession';
import { GeminiLiveSession } from '../../services/geminiLive';
import { OpenAIRealtimeLiveSession } from '../../services/openaiRealtimeLive';

const scenario: LiveScenario = {
  id: 'test-scenario',
  theme: 'Cafe order',
  intensity: 'normal',
  descriptionPt: 'Peça um café',
  systemPrompt: 'You are a barista.',
  userRole: 'customer',
  aiRole: 'barista',
  suggestedVoice: 'Aoede',
};

beforeEach(() => {
  capturedCallbacks = null;
  mockDisconnect.mockClear();
  mockConnect.mockClear();
  mockStartMic.mockClear();
  mockStopMic.mockClear();
  vi.mocked(GeminiLiveSession).mockClear();
  vi.mocked(OpenAIRealtimeLiveSession).mockClear();
  mockGetRuntimeModelConfig.mockReturnValue({ liveSource: 'gemini' });
});

describe('LiveSession', () => {
  it('instantiates GeminiLiveSession when liveSource is gemini', () => {
    mockGetRuntimeModelConfig.mockReturnValue({ liveSource: 'gemini' });
    render(<LiveSession scenario={scenario} onEnd={vi.fn()} onExit={vi.fn()} />);
    expect(vi.mocked(GeminiLiveSession)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(OpenAIRealtimeLiveSession)).not.toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledWith(scenario.systemPrompt, scenario.suggestedVoice);
  });

  it('instantiates OpenAIRealtimeLiveSession when liveSource is openai', () => {
    mockGetRuntimeModelConfig.mockReturnValue({ liveSource: 'openai' });
    render(<LiveSession scenario={scenario} onEnd={vi.fn()} onExit={vi.fn()} />);
    expect(vi.mocked(OpenAIRealtimeLiveSession)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(GeminiLiveSession)).not.toHaveBeenCalled();
  });

  it('calls session.disconnect exactly once on unmount', () => {
    const { unmount } = render(
      <LiveSession scenario={scenario} onEnd={vi.fn()} onExit={vi.fn()} />,
    );
    expect(mockDisconnect).not.toHaveBeenCalled();
    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('renders the error banner when the onError callback fires', () => {
    render(<LiveSession scenario={scenario} onEnd={vi.fn()} onExit={vi.fn()} />);
    expect(capturedCallbacks).not.toBeNull();

    // No error yet -> no banner.
    expect(screen.queryByText(/something went wrong|failed|erro/i)).not.toBeInTheDocument();

    act(() => {
      capturedCallbacks!.onError('Connection failed');
    });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders all subcomponent shells (SceneCard, MicPanel, ChatHistory, ActionBar)', () => {
    render(<LiveSession scenario={scenario} onEnd={vi.fn()} onExit={vi.fn()} />);
    expect(screen.getByTestId('scene-card-stub')).toBeInTheDocument();
    expect(screen.getByTestId('mic-panel-stub')).toBeInTheDocument();
    expect(screen.getByTestId('chat-history-stub')).toBeInTheDocument();
    expect(screen.getByTestId('action-bar-stub')).toBeInTheDocument();
  });
});
