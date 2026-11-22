import type { CapacitorConfig } from '@capacitor/cli';

// The app loads the live driver portal (Next.js on Vercel) inside a native
// shell, so every driver screen stays one codebase with the website. Native
// plugins add what a phone browser cannot do: location while the app is in
// the background, haptics, and a proper splash screen.
//
// EPYC_APP_URL points a test build at a Vercel preview instead of the live
// site, for example:  EPYC_APP_URL=https://<preview-host>/driver/jobs npx cap sync
const appUrl = process.env.EPYC_APP_URL || 'https://www.epyccs.com/driver/jobs';
const host = new URL(appUrl).host;

const config: CapacitorConfig = {
  appId: 'com.epyccs.driver',
  appName: 'EPYC Driver',
  // Offline page shown only if the portal cannot load at all.
  webDir: 'www',
  server: {
    url: appUrl,
    cleartext: false,
    // Stay inside the app for the portal; other links open outside it.
    allowNavigation: [host, 'www.epyccs.com', 'epyccs.com'],
    errorPath: 'index.html',
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    // Keeps background location updates flowing past 5 minutes on Android
    // (background-geolocation plugin requirement).
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
