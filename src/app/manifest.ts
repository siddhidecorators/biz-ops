import type { MetadataRoute } from 'next';

// Next 16 auto-links this at /manifest.webmanifest. No <link> tag needed in
// layout — Next reads the function's return value at build time.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SmallBiz Ops',
    short_name: 'SmallBiz',
    description:
      'Customers, products, quotes and tax invoices — built for Indian small businesses, on your phone.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBF7F2',
    theme_color: '#B8552A',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        // Same SVG flagged as maskable — Android adaptive-icon shells will
        // crop/pad it correctly because our SVG already has internal padding.
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    categories: ['business', 'productivity', 'finance'],
  };
}
