import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import { getSwipeNavigation } from './Slideshow';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.includes('/api/getTags')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(['family', 'travel']),
      });
    }

    if (url.includes('/api/getPictures')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'photo-1',
            url: 'https://example.com/photo-1.jpg',
            tags: ['family'],
            title: 'Backyard dinner',
          },
          {
            id: 'photo-2',
            url: 'https://example.com/photo-2.jpg',
            tags: ['travel'],
            title: 'Mountain overlook',
          },
        ]),
      });
    }

    return Promise.reject(new Error(`Unhandled request: ${url}`));
  });

  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

test('loads tags and a random photo batch', async () => {
  render(<App />);

  expect(screen.getByText(/loading gallery/i)).not.toBeNull();

  expect(await screen.findByRole('button', { name: 'family' })).not.toBeNull();

  await waitFor(() => {
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.com/photo-1.jpg');
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/getTags', expect.any(Object));
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/getPictures?limit=12&random=true',
    expect.any(Object)
  );
});

test('detects horizontal swipe navigation', () => {
  expect(getSwipeNavigation({ x: 220, y: 120 }, { x: 130, y: 124 })).toBe('next');
  expect(getSwipeNavigation({ x: 130, y: 120 }, { x: 220, y: 124 })).toBe('previous');
});

test('ignores short and mostly vertical swipe gestures', () => {
  expect(getSwipeNavigation({ x: 220, y: 120 }, { x: 180, y: 124 })).toBeNull();
  expect(getSwipeNavigation({ x: 220, y: 120 }, { x: 160, y: 240 })).toBeNull();
});
