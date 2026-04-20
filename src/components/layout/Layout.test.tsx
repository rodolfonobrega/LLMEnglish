import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';

// Stub all layout subcomponents so the test exercises Layout's composition
// without pulling in hooks that touch storage / theme / gamification.
vi.mock('./Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar-stub">sidebar</div>,
}));
vi.mock('./Navigation', () => ({
  Navigation: () => <div data-testid="navigation-stub">nav</div>,
}));
vi.mock('./Header', () => ({
  Header: () => <div data-testid="header-stub">header</div>,
}));
vi.mock('./DevBanner', () => ({
  DevBanner: () => <div data-testid="dev-banner-stub">dev</div>,
}));
vi.mock('../ui/PageSkeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton-stub">loading</div>,
}));

function renderLayoutAt(path: string, childMarkup: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={childMarkup} />
          <Route path="inner" element={childMarkup} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  it('renders the nested route element through <Outlet />', () => {
    renderLayoutAt('/', <div data-testid="outlet-child">child-content</div>);
    expect(screen.getByTestId('outlet-child')).toBeInTheDocument();
    expect(screen.getByText('child-content')).toBeInTheDocument();
  });

  it('renders Header, DevBanner, Sidebar and mobile Navigation shells around the outlet', () => {
    renderLayoutAt('/', <div data-testid="outlet-child">x</div>);
    expect(screen.getByTestId('header-stub')).toBeInTheDocument();
    expect(screen.getByTestId('dev-banner-stub')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-stub')).toBeInTheDocument();
    expect(screen.getByTestId('navigation-stub')).toBeInTheDocument();
  });

  it('wraps the outlet inside a <main> landmark', () => {
    renderLayoutAt('/', <div data-testid="outlet-child">x</div>);
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('outlet-child'));
  });

  it('renders a different child when routing to a different index', () => {
    renderLayoutAt('/inner', <div data-testid="inner-child">inner</div>);
    expect(screen.getByTestId('inner-child')).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Auth gate lives in App.tsx (ProtectedApp). We assert the gate contract here
// by re-creating it inline against the same AuthContext surface that App uses:
// - loading  -> spinner
// - no user  -> <Navigate to="/login" replace />
// - user     -> children
// If App.tsx's gate diverges from this contract, update accordingly.
// -----------------------------------------------------------------------------
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function ProtectedStub({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth() as { user: unknown; loading: boolean };
  if (loading) return <div data-testid="auth-loading">loading</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

describe('ProtectedApp auth gate (contract mirror of App.tsx)', () => {
  it('renders children when user is truthy', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' }, loading: false } as never);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedStub>
                <div data-testid="authed-content">hello</div>
              </ProtectedStub>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('authed-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is null and not loading', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedStub>
                <div data-testid="authed-content">hello</div>
              </ProtectedStub>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('authed-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('shows a loading fallback while auth is bootstrapping', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedStub>
                <div data-testid="authed-content">hello</div>
              </ProtectedStub>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('authed-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
