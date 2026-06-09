// LocalBusiness structured data (JSON-LD) for EPYC Courier Service.
// Improves local-SEO eligibility for rich results and Google Business surfaces.
// NAP sourced from Footer.tsx; do not invent a street address (none published).

const businessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://www.epyccs.com/#business',
  name: 'EPYC Courier Service',
  legalName: 'UDIG Solutions Inc',
  url: 'https://www.epyccs.com',
  telephone: '+1-818-217-0070',
  email: 'admin@epyccs.com',
  description:
    "Southern California's trusted same-day courier service: HIPAA-compliant medical specimen delivery, legal document courier, and commercial packages with GPS tracking and proof of delivery.",
  priceRange: '$$',
  address: {
    '@type': 'PostalAddress',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  areaServed: [
    { '@type': 'City', name: 'Los Angeles' },
    { '@type': 'AdministrativeArea', name: 'Orange County' },
    { '@type': 'City', name: 'San Diego' },
    { '@type': 'AdministrativeArea', name: 'Southern California' },
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
  ],
  sameAs: [
    'https://www.facebook.com/profile.php?id=61586753098066',
    'https://www.linkedin.com/company/111494085',
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Courier Services',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Medical Courier',
          description:
            'HIPAA-compliant delivery for specimens, pharmaceuticals, medical records, and equipment with chain of custody documentation.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Legal Courier',
          description:
            'Same-day court filings and legal document delivery with signature capture and proof of delivery.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Commercial Delivery',
          description:
            'Same-day business-to-business and commercial package delivery across Southern California.',
        },
      },
    ],
  },
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
    />
  );
}
