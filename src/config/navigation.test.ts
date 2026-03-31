import { describe, expect, it } from 'vitest';
import { primaryNavItems } from './navigation';

describe('primaryNavItems', () => {
  it('contains the six approved top-level destinations', () => {
    expect(primaryNavItems.map(item => item.to)).toEqual([
      '/',
      '/practice',
      '/library',
      '/review',
      '/errors',
      '/settings',
    ]);
  });

  it('includes /practice and /errors as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/practice')).toBe(true);
    expect(primaryNavItems.some(item => item.to === '/errors')).toBe(true);
  });

  it('excludes /paths, /scripts, /live, /history as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/paths')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/scripts')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/live')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/history')).toBe(false);
  });
});
