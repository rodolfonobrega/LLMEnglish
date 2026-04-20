import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ApiKeysSection } from './ApiKeysSection';

// ---------------------------------------------------------------------------
// ApiKeysSection is a controlled presentational component. The real
// `saveApiKeys` call lives in SettingsPage; here we test:
//   1. Typing in each input fires the matching onXKeyChange handler.
//   2. The `isDevMode` flag disables inputs.
//   3. In a small host wrapper that mirrors SettingsPage's save flow,
//      a save success calls `saveApiKeys` with the expected shape, and
//      a save failure surfaces the error state to the DOM.
// ---------------------------------------------------------------------------

vi.mock('../../../services/storage', () => ({
  saveApiKeys: vi.fn(),
}));

import { saveApiKeys } from '../../../services/storage';

const defaultProps = {
  isDevMode: false,
  openaiKey: '',
  geminiKey: '',
  groqKey: '',
  openrouterKey: '',
  vertexProjectId: '',
  vertexRegion: 'us-central1',
  onOpenaiKeyChange: vi.fn(),
  onGeminiKeyChange: vi.fn(),
  onGroqKeyChange: vi.fn(),
  onOpenrouterKeyChange: vi.fn(),
  onVertexProjectIdChange: vi.fn(),
  onVertexRegionChange: vi.fn(),
};

function makeProps(overrides: Partial<typeof defaultProps> = {}) {
  return { ...defaultProps, ...overrides };
}

describe('ApiKeysSection (controlled inputs)', () => {
  it('fires onOpenaiKeyChange for each character typed in the OpenAI key input', async () => {
    const onOpenaiKeyChange = vi.fn();
    const user = userEvent.setup();
    render(<ApiKeysSection {...makeProps({ onOpenaiKeyChange })} />);

    const input = screen.getByLabelText(/OpenAI API Key/i);
    await user.type(input, 'abc');
    // user.type fires change for each char; last arg is most recent char.
    expect(onOpenaiKeyChange).toHaveBeenCalledTimes(3);
    expect(onOpenaiKeyChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onOpenaiKeyChange).toHaveBeenNthCalledWith(2, 'b');
    expect(onOpenaiKeyChange).toHaveBeenNthCalledWith(3, 'c');
  });

  it('fires onGeminiKeyChange when typing in the Gemini key input', async () => {
    const onGeminiKeyChange = vi.fn();
    const user = userEvent.setup();
    render(<ApiKeysSection {...makeProps({ onGeminiKeyChange })} />);

    const input = screen.getByLabelText(/Google Gemini API Key/i);
    await user.type(input, 'x');
    expect(onGeminiKeyChange).toHaveBeenCalledWith('x');
  });

  it('disables all API key inputs in dev mode and shows the dev mode notice', () => {
    render(<ApiKeysSection {...makeProps({ isDevMode: true })} />);
    expect(screen.getByText(/API keys loaded from environment variables/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/OpenAI API Key/i)).toBeDisabled();
    expect(screen.getByLabelText(/Google Gemini API Key/i)).toBeDisabled();
    expect(screen.getByLabelText(/Groq API Key/i)).toBeDisabled();
    expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeDisabled();
  });

  it('reflects controlled values through the value prop', () => {
    render(<ApiKeysSection {...makeProps({ openaiKey: 'sk-existing', geminiKey: 'gmn-existing' })} />);
    expect(screen.getByLabelText(/OpenAI API Key/i)).toHaveValue('sk-existing');
    expect(screen.getByLabelText(/Google Gemini API Key/i)).toHaveValue('gmn-existing');
  });
});

// ---------------------------------------------------------------------------
// Host wrapper mirroring SettingsPage's save flow — exercises the integration
// between the controlled section and saveApiKeys without pulling the full
// SettingsPage (which depends on auth + runtime state).
// ---------------------------------------------------------------------------

function ApiKeysSectionHost() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await saveApiKeys({
        openai: openaiKey || '',
        genai: geminiKey || '',
        groq: groqKey || '',
        openrouter: openrouterKey || '',
      });
      setSaved(true);
    } catch {
      setSaveError('Erro ao salvar configuracoes. Tente novamente.');
    }
  };

  return (
    <div>
      <ApiKeysSection
        isDevMode={false}
        openaiKey={openaiKey}
        geminiKey={geminiKey}
        groqKey={groqKey}
        openrouterKey={openrouterKey}
        vertexProjectId={vertexProjectId}
        vertexRegion={vertexRegion}
        onOpenaiKeyChange={setOpenaiKey}
        onGeminiKeyChange={setGeminiKey}
        onGroqKeyChange={setGroqKey}
        onOpenrouterKeyChange={setOpenrouterKey}
        onVertexProjectIdChange={setVertexProjectId}
        onVertexRegionChange={setVertexRegion}
      />
      <button type="button" onClick={handleSave}>
        Salvar
      </button>
      {saved && <div data-testid="saved-flag">salvo</div>}
      {saveError && <div role="alert">{saveError}</div>}
    </div>
  );
}

describe('ApiKeysSection integrated with a SettingsPage-style save flow', () => {
  it('save success calls saveApiKeys with the expected shape', async () => {
    vi.mocked(saveApiKeys).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ApiKeysSectionHost />);

    await user.type(screen.getByLabelText(/OpenAI API Key/i), 'sk-test');
    await user.type(screen.getByLabelText(/Google Gemini API Key/i), 'g-test');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    expect(saveApiKeys).toHaveBeenCalledTimes(1);
    expect(saveApiKeys).toHaveBeenCalledWith({
      openai: 'sk-test',
      genai: 'g-test',
      groq: '',
      openrouter: '',
    });
    expect(await screen.findByTestId('saved-flag')).toBeInTheDocument();
  });

  it('save failure surfaces the error state to the DOM', async () => {
    vi.mocked(saveApiKeys).mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ApiKeysSectionHost />);

    await user.type(screen.getByLabelText(/OpenAI API Key/i), 'sk-broken');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Erro ao salvar/i);
    expect(screen.queryByTestId('saved-flag')).not.toBeInTheDocument();
  });
});
