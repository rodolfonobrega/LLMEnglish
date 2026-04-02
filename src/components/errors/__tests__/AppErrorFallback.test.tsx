import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { AppErrorFallback } from '../AppErrorFallback';

describe('AppErrorFallback', () => {
  it('renders heading "Erro inesperado"', () => {
    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText('Erro inesperado')).toBeInTheDocument();
  });

  it('renders error.message from the error prop', () => {
    render(<AppErrorFallback error={new Error('App crashed')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText('App crashed')).toBeInTheDocument();
  });

  it('renders a button with text "Recarregar pagina"', () => {
    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByRole('button', { name: /recarregar pagina/i })).toBeInTheDocument();
  });

  it('does NOT render navigation hint (no sidebar available)', () => {
    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);
    expect(screen.queryByText(/barra lateral/i)).not.toBeInTheDocument();
  });

  it('uses a raw button element (NOT the Button component)', () => {
    const { container } = render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);
    // Raw <button> without data-slot from Radix/Btn component
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button?.getAttribute('data-slot')).toBeNull();
  });

  it('logs error to console.error with prefix "[AppErrorBoundary]"', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('logged error');
    render(<AppErrorFallback error={error} resetErrorBoundary={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith('[AppErrorBoundary]', error);
    consoleSpy.mockRestore();
  });

  it('reloads page on button click', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: reloadMock } as unknown as Location);

    render(<AppErrorFallback error={new Error('boom')} resetErrorBoundary={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /recarregar pagina/i }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
