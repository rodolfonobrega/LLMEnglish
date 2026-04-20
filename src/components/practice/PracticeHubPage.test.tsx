import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PracticeHubPage } from './PracticeHubPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

beforeEach(() => {
  navigateMock.mockClear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PracticeHubPage />
    </MemoryRouter>,
  );
}

function getSectionByName(name: string) {
  const headings = screen.getAllByText(name);
  // Find the section that contains this heading
  for (const heading of headings) {
    const section = heading.closest('section');
    if (section) return section;
  }
  return null;
}

describe('PracticeHubPage', () => {
  it('renders "Pratica Solo" section header text', () => {
    renderPage();
    expect(screen.getByText('Pratica Solo')).toBeInTheDocument();
  });

  it('renders "Ao Vivo" section header text', () => {
    renderPage();
    expect(screen.getByText('Ao Vivo')).toBeInTheDocument();
  });

  it('Pratica Solo section contains exactly 5 PracticeModeCard buttons', () => {
    renderPage();
    const soloSection = getSectionByName('Pratica Solo');
    expect(soloSection).not.toBeNull();
    const buttons = within(soloSection!).getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('Ao Vivo section contains exactly 2 PracticeModeCard buttons', () => {
    renderPage();
    const liveSection = getSectionByName('Ao Vivo');
    expect(liveSection).not.toBeNull();
    const buttons = within(liveSection!).getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('does NOT import or render ModeTooltip', () => {
    renderPage();
    // ModeTooltip renders a wrapping div with role="tooltip" or similar
    // If ModeTooltip is used, there would be tooltip-related elements
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('"visual" mode (Desafio Visual) appears in Pratica Solo section, NOT Ao Vivo', () => {
    renderPage();
    const soloSection = getSectionByName('Pratica Solo');
    const liveSection = getSectionByName('Ao Vivo');
    expect(soloSection).not.toBeNull();
    expect(liveSection).not.toBeNull();
    // "Desafio Visual" label should be in solo section
    expect(within(soloSection!).getByText('Desafio Visual')).toBeInTheDocument();
    // "Desafio Visual" label should NOT be in live section
    expect(within(liveSection!).queryByText('Desafio Visual')).not.toBeInTheDocument();
  });

  it('"simulation" mode appears in Ao Vivo section', () => {
    renderPage();
    const liveSection = getSectionByName('Ao Vivo');
    expect(liveSection).not.toBeNull();
    expect(within(liveSection!).getByText('Simulação ao Vivo')).toBeInTheDocument();
  });

  it('"trails" mode appears in Ao Vivo section', () => {
    renderPage();
    const liveSection = getSectionByName('Ao Vivo');
    expect(liveSection).not.toBeNull();
    expect(within(liveSection!).getByText('Trilhas')).toBeInTheDocument();
  });

  it('all 7 modes are present across both sections with no duplicates', () => {
    renderPage();
    const allButtons = screen.getAllByRole('button');
    // 5 in solo + 2 in live = 7 total
    expect(allButtons).toHaveLength(7);
    // Verify all 7 unique mode labels are present
    const expectedLabels = [
      'Frases', 'Textos', 'Situações', 'Scripts',
      'Desafio Visual', 'Simulação ao Vivo', 'Trilhas',
    ];
    for (const label of expectedLabels) {
      const elements = screen.getAllByText(label);
      expect(elements).toHaveLength(1);
    }
  });

  it('clicking the Frases mode card navigates to /exercises?mode=phrases', async () => {
    const user = userEvent.setup();
    renderPage();
    // Each PracticeModeCard is a button with aria-label "<Label>: <description>".
    const frasesCard = screen.getByRole('button', { name: /^Frases:/ });
    await user.click(frasesCard);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/exercises?mode=phrases');
  });

  it('clicking the Simulação ao Vivo mode card navigates to /live', async () => {
    const user = userEvent.setup();
    renderPage();
    const liveCard = screen.getByRole('button', { name: /^Simulação ao Vivo:/ });
    await user.click(liveCard);
    expect(navigateMock).toHaveBeenCalledWith('/live');
  });

  it('clicking the Trilhas mode card navigates to /paths', async () => {
    const user = userEvent.setup();
    renderPage();
    const trilhasCard = screen.getByRole('button', { name: /^Trilhas:/ });
    await user.click(trilhasCard);
    expect(navigateMock).toHaveBeenCalledWith('/paths');
  });

  it('clicking the Scripts mode card navigates to /scripts', async () => {
    const user = userEvent.setup();
    renderPage();
    const scriptsCard = screen.getByRole('button', { name: /^Scripts:/ });
    await user.click(scriptsCard);
    expect(navigateMock).toHaveBeenCalledWith('/scripts');
  });
});
