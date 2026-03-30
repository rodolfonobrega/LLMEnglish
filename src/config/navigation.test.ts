import { describe, expect, it } from 'vitest';
import { primaryNavItems } from './navigation';

describe('primaryNavItems', () => {
  it('contains only the five approved top-level destinations', () => {
    expect(primaryNavItems.map(item => item.to)).toEqual([
      '/',
      '/practice',
      '/review',
      '/library',
      '/settings',
    ]);
  });

  it('includes /practice and excludes /paths, /scripts, /live as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/practice')).toBe(true);
    expect(primaryNavItems.some(item => item.to === '/paths')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/scripts')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/live')).toBe(false);
  });
});
