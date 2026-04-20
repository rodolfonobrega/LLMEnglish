import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_MODEL_CONFIG } from '../../../types/settings';
import type { ModelConfig } from '../../../types/settings';
import { ModelConfigSection } from './ModelConfigSection';

function makeConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return { ...DEFAULT_MODEL_CONFIG, ...overrides };
}

describe('ModelConfigSection', () => {
  it('renders the section header and all 5 model-category subsections', () => {
    render(
      <ModelConfigSection
        config={makeConfig()}
        onConfigChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Configuração de Modelos/i)).toBeInTheDocument();
    expect(screen.getByText(/Geração de Texto/i)).toBeInTheDocument();
    expect(screen.getByText(/Fala para Texto/i)).toBeInTheDocument();
    expect(screen.getByText(/Texto para Fala/i)).toBeInTheDocument();
    expect(screen.getByText(/Geração de Imagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulação ao Vivo/i)).toBeInTheDocument();
  });

  it('changing the Chat model dropdown fires onConfigChange with the partial', async () => {
    const onConfigChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ModelConfigSection
        config={makeConfig({ chatSource: 'genai', chatModel: 'gemini-3.1-flash-lite-preview' })}
        onConfigChange={onConfigChange}
        onReset={vi.fn()}
      />,
    );

    // The "Chat - Modelo" select exposes the currently-selected genai models.
    const chatModelSelect = screen.getByLabelText(/Chat - Modelo/i);
    await user.selectOptions(chatModelSelect, 'gemini-2.5-flash');

    expect(onConfigChange).toHaveBeenCalledWith({
      chatSource: 'genai',
      chatModel: 'gemini-2.5-flash',
    });
  });

  it('changing the Chat provider fires onConfigChange with new source + first model for that source', async () => {
    const onConfigChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ModelConfigSection
        config={makeConfig({ chatSource: 'genai' })}
        onConfigChange={onConfigChange}
        onReset={vi.fn()}
      />,
    );

    const chatSourceSelect = screen.getByLabelText(/Chat - Provedor/i);
    await user.selectOptions(chatSourceSelect, 'openai');

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const partial = onConfigChange.mock.calls[0][0];
    expect(partial).toMatchObject({ chatSource: 'openai' });
    // chatModel should be set to the first openai chat model (GPT-5.4).
    expect(partial.chatModel).toBeTruthy();
    expect(typeof partial.chatModel).toBe('string');
  });

  it('clicking "Resetar" calls onReset', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(
      <ModelConfigSection
        config={makeConfig()}
        onConfigChange={vi.fn()}
        onReset={onReset}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Resetar/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('changing TTS voice fires onConfigChange with only the ttsVoice partial', async () => {
    const onConfigChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ModelConfigSection
        config={makeConfig({ ttsSource: 'genai', ttsModel: 'gemini-2.5-flash-preview-tts', ttsVoice: 'Kore' })}
        onConfigChange={onConfigChange}
        onReset={vi.fn()}
      />,
    );

    // There are multiple "Voz" selects (TTS + Live). Pick the TTS one by
    // finding the one whose currently-selected value matches a Gemini voice
    // ('Kore'). Simpler: query all and the first is the TTS voice select
    // because TTS section renders before the Live section.
    const vozSelects = screen.getAllByLabelText(/^Voz$/i);
    expect(vozSelects.length).toBeGreaterThanOrEqual(1);
    await user.selectOptions(vozSelects[0], 'Puck');

    expect(onConfigChange).toHaveBeenCalledWith({ ttsVoice: 'Puck' });
  });
});
