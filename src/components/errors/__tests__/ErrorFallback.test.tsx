import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

// Mock react-router-dom to provide useRouteError and useNavigate
vi.mock('react-router-dom', () => ({
  useRouteError: vi.fn(),
  useNavigate: vi.fn(),
}));

import { useRouteError, useNavigate } from 'react-router-dom';
import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback', () => {
  it('renders heading "Algo deu errado" when no error is provided', () => {
    vi.mocked(useRouteError).mockReturnValue(null);
    render(<ErrorFallback />);
    expect(screen.getByRole('heading', { name: /algo deu errado/i })).toBeInTheDocument();
  });

  it('renders error.message when error is an Error instance', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('Test crash'));
    render(<ErrorFallback />);
    expect(screen.getByText('Test crash')).toBeInTheDocument();
  });

  it('renders "Algo deu errado" when error is a string', () => {
    vi.mocked(useRouteError).mockReturnValue('some string error');
    render(<ErrorFallback />);
    expect(screen.getByRole('heading', { name: /algo deu errado/i })).toBeInTheDocument();
  });

  it('renders a button with text "Tentar novamente"', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('err'));
    render(<ErrorFallback />);
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('renders navigation hint about sidebar', () => {
    vi.mocked(useRouteError).mockReturnValue(new Error('err'));
    render(<ErrorFallback />);
    expect(screen.getByText(/use a barra lateral para navegar/i)).toBeInTheDocument();
  });

  it('calls window.location.reload on button click', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload: reloadMock } as unknown as Location);
    vi.mocked(useRouteError).mockReturnValue(new Error('err'));

    render(<ErrorFallback />);
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
