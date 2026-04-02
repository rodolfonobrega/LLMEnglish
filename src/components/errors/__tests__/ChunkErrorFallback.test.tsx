import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { ChunkErrorFallback } from '../ChunkErrorFallback';

describe('ChunkErrorFallback', () => {
  it('renders heading "Falha ao carregar"', () => {
    render(<ChunkErrorFallback error={new Error('chunk')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
  });

  it('renders body text about failing to load page', () => {
    render(<ChunkErrorFallback error={new Error('chunk')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText(/nao foi possivel carregar esta pagina/i)).toBeInTheDocument();
  });

  it('renders a button with text "Tentar novamente"', () => {
    render(<ChunkErrorFallback error={new Error('chunk')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('calls resetErrorBoundary on button click (not window.location.reload)', async () => {
    const user = userEvent.setup();
    const resetMock = vi.fn();

    render(<ChunkErrorFallback error={new Error('chunk')} resetErrorBoundary={resetMock} />);
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('renders navigation hint about sidebar', () => {
    render(<ChunkErrorFallback error={new Error('chunk')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText(/use a barra lateral para navegar/i)).toBeInTheDocument();
  });
});
