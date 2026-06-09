import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.epyccs.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/services/medical', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/services/legal', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/services/commercial', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/careers', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/track', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
