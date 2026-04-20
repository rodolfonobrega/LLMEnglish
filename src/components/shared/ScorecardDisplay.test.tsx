import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorecardDisplay } from './ScorecardDisplay';

describe('ScorecardDisplay', () => {
  const baseScores = {
    naturalness: 40,
    accuracy: 85,
    fluency: 55,
    pragmatics: 70,
    completeness: 90,
  };

  it('renders all five dimensions with Portuguese labels', () => {
    render(<ScorecardDisplay scores={baseScores} />);
    expect(screen.getByText('Naturalidade')).toBeInTheDocument();
    expect(screen.getByText('Precisão')).toBeInTheDocument();
    expect(screen.getByText('Fluência')).toBeInTheDocument();
    expect(screen.getByText('Registro')).toBeInTheDocument();
    expect(screen.getByText('Completude')).toBeInTheDocument();
  });

  it('marks the primary dimension with the foco-agora badge', () => {
    render(<ScorecardDisplay scores={baseScores} primaryDimension="naturalness" />);
    expect(screen.getByText('Foco agora')).toBeInTheDocument();
  });

  it('renders the scalar ring when a scalar is provided', () => {
    render(<ScorecardDisplay scores={baseScores} scalar={7.3} />);
    expect(screen.getByText('7.3')).toBeInTheDocument();
  });

  it('omits the scalar ring when no scalar is provided', () => {
    render(<ScorecardDisplay scores={baseScores} />);
    // Numbers 40/85/55/70/90 are the axis values, none equals a *.* scalar format
    expect(screen.queryByText(/^\d\.\d$/)).not.toBeInTheDocument();
  });

  it('renders each axis value as an integer', () => {
    render(<ScorecardDisplay scores={baseScores} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
  });
});
