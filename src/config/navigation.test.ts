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
});
