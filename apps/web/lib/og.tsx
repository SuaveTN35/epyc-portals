import { ImageResponse } from 'next/og';

// Shared Open Graph / Twitter card renderer for EPYC Courier Service.
// 1200x630 brand card (no binary asset required) used by both
// app/opengraph-image.tsx and app/twitter-image.tsx.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';
export const OG_ALT =
  'EPYC Courier Service - Southern California same-day medical, legal, and commercial courier';

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          backgroundImage:
            'linear-gradient(135deg, #064E3B 0%, #0F766E 50%, #1E40AF 100%)',
        }}
      >
        {/* Brand wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 110,
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            EPYC
          </div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: '14px',
              opacity: 0.9,
              marginTop: 6,
            }}
          >
            COURIER SERVICE
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.12,
              maxWidth: 980,
            }}
          >
            Southern California&apos;s Most Reliable Same-Day Courier
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: '#6EE7B7',
              marginTop: 18,
            }}
          >
            Medical&nbsp;&nbsp;|&nbsp;&nbsp;Legal&nbsp;&nbsp;|&nbsp;&nbsp;Commercial
          </div>
        </div>

        {/* Footer: trust signals + contact */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.25)',
            paddingTop: 28,
            fontSize: 26,
          }}
        >
          <div style={{ display: 'flex', opacity: 0.92 }}>
            HIPAA Compliant &nbsp;&middot;&nbsp; Licensed &amp; Bonded &nbsp;&middot;&nbsp; GPS Tracking
          </div>
          <div style={{ display: 'flex', fontWeight: 700 }}>
            (818) 217-0070 &nbsp;&middot;&nbsp; epyccs.com
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
