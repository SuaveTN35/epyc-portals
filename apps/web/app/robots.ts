import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.epyccs.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/client/', '/dispatch/', '/driver/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
