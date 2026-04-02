import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PracticeModeCard } from './PracticeModeCard';
import { exerciseModes } from '../../config/modes';

const testMode = exerciseModes[0]; // phrases mode

describe('PracticeModeCard', () => {
  it('renders a button element (not a div)', () => {
    render(<PracticeModeCard mode={testMode} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('has aria-label attribute containing mode label and description', () => {
    render(<PracticeModeCard mode={testMode} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', `${testMode.label}: ${testMode.description}`);
  });

  it('renders an img element with mode.image src when mode.image is provided', () => {
    render(<PracticeModeCard mode={testMode} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', testMode.image);
  });

  it('renders gradient fallback with Lucide icon when img onError fires', () => {
    render(<PracticeModeCard mode={testMode} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    // After error, img should be removed and fallback appears
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // The fallback should contain an SVG (Lucide icon)
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders gradient fallback when mode has no image', () => {
    const modeWithoutImage = { ...testMode, image: undefined };
    render(<PracticeModeCard mode={modeWithoutImage} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders mode label text', () => {
    render(<PracticeModeCard mode={testMode} />);
    expect(screen.getByText(testMode.label)).toBeInTheDocument();
  });

  it('renders mode description text', () => {
    render(<PracticeModeCard mode={testMode} />);
    expect(screen.getByText(testMode.description)).toBeInTheDocument();
  });

  it('renders "Ex: " prefix followed by mode example text', () => {
    render(<PracticeModeCard mode={testMode} />);
    const exampleText = screen.getByText(`Ex: ${testMode.example}`);
    expect(exampleText).toBeInTheDocument();
  });

  it('image container has "h-40" class', () => {
    render(<PracticeModeCard mode={testMode} />);
    const button = screen.getByRole('button');
    const imageContainer = button.querySelector('.h-40');
    expect(imageContainer).toBeInTheDocument();
  });

  it('fires onClick when button is clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PracticeModeCard mode={testMode} onClick={onClick} />);
    const button = screen.getByRole('button');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has focus-visible ring classes', () => {
    render(<PracticeModeCard mode={testMode} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('focus-visible:ring-2');
  });
});
