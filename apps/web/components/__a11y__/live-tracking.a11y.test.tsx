// Automated accessibility check (axe-core, WCAG 2.0/2.1/2.2 A and AA rules)
// for the driver location notice and the customer live tracking card.
// jsdom has no layout, so axe cannot measure color contrast here; the
// contrast pairs these components use are checked by formula below.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import axe from 'axe-core';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => ({ isLoaded: false, loadError: null, google: null }),
}));

import { LocationSharing } from '@/components/driver/LocationSharing';
import { LiveDeliveryTracker } from '@/components/delivery/LiveDeliveryTracker';
import { DeleteAccount } from '@/components/settings/DeleteAccount';

const JOB = '3f2b6c1e-8a4d-4f2a-9b7c-1d2e3f4a5b6c';

async function axeViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  return result.violations.map((v) => `${v.id}: ${v.help}`);
}

type PositionCb = (p: GeolocationPosition) => void;
type ErrorCb = (e: GeolocationPositionError) => void;
let onPosition: PositionCb | null = null;
let onError: ErrorCb | null = null;

beforeEach(() => {
  onPosition = null;
  onError = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: PositionCb, err: ErrorCb) => {
        onPosition = ok;
        onError = err;
        return 1;
      },
      clearWatch: () => undefined,
    },
  });
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vi.fn(() => true) });
  setPermission('granted');
});

function setPermission(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn(async () => ({ state })) },
  });
}

describe('Driver location notice', () => {
  it('announces sharing politely and has no axe violations', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
    const { container } = render(<LocationSharing deliveryId={JOB} active />);
    await waitFor(() => expect(onPosition).not.toBeNull());
    await act(async () => {
      onPosition?.({ coords: { latitude: 34.05, longitude: -118.24, accuracy: 10, speed: null, heading: null } } as GeolocationPosition);
    });
    const notice = await screen.findByRole('status');
    await waitFor(() => expect(notice.textContent).toMatch(/Sharing your location/));
    expect(await axeViolations(container)).toEqual([]);
  });

  it('explains location use before the phone asks, with no axe violations', async () => {
    setPermission('prompt');
    const watch = vi.spyOn(navigator.geolocation, 'watchPosition');
    const { container } = render(<LocationSharing deliveryId={JOB} active />);
    const region = await screen.findByRole('region', { name: 'Share your location for this job' });
    expect(region.textContent).toMatch(/not collected when you have no job/);
    expect(watch).not.toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
    await act(async () => {
      screen.getByRole('button', { name: 'Turn on location' }).click();
    });
    expect(watch).toHaveBeenCalled();
  });

  it('shows a denied location as an alert and vibrates, never sound alone', async () => {
    const { container } = render(<LocationSharing deliveryId={JOB} active />);
    await waitFor(() => expect(onError).not.toBeNull());
    await act(async () => {
      onError?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Location is off/);
    expect(navigator.vibrate).toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Customer live tracking card', () => {
  it('labels the card, the map and the link, with no axe violations', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'picked_up',
            driver: { lat: 34.03, lng: -118.3, recordedAt: new Date().toISOString() },
            pickup: { lat: 34.05, lng: -118.24 },
            dropoff: { lat: 34.01, lng: -118.49 },
          }),
          { status: 200 }
        )
    ) as typeof fetch;
    const { container } = render(<LiveDeliveryTracker deliveryId={JOB} initialStatus="picked_up" />);
    expect(screen.getByRole('region', { name: 'Live tracking' })).toBeTruthy();
    await screen.findByText(/Driver location updated/);
    expect(screen.getByRole('img', { name: /driver's current location/ })).toBeTruthy();
    const link = screen.getByRole('link');
    expect(link.textContent).toBe('Open driver location in Google Maps (opens in a new tab)');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('status').textContent).toBe('Picked up, on the way');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Delete account', () => {
  it('needs DELETE typed, labels the field and has no axe violations', async () => {
    const { container } = render(<DeleteAccount audience="driver" />);
    expect(screen.getByRole('region', { name: 'Delete account' }).textContent).toMatch(/location history/);
    await act(async () => {
      screen.getByRole('button', { name: 'Delete my account' }).click();
    });
    const field = screen.getByLabelText('Type DELETE to confirm');
    const submit = screen.getByRole('button', { name: 'Delete my account for good' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(await axeViolations(container)).toEqual([]);
  });
});

// WCAG 1.4.3: normal text needs 4.5:1. Pairs used by these components.
function luminance(hex: string): number {
  const c = hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe('color contrast (WCAG 1.4.3 AA)', () => {
  const pairs: Array<[string, string, string]> = [
    ['sharing on: green-800 on green-50', '#166534', '#f0fdf4'],
    ['problem: amber-900 on amber-50', '#78350f', '#fffbeb'],
    ['starting: gray-700 on gray-50', '#374151', '#f9fafb'],
    ['card text: gray-700 on white', '#374151', '#ffffff'],
    ['link: Epyc green on white', '#065F46', '#ffffff'],
    ['map notice: gray-700 on gray-50', '#374151', '#f9fafb'],
    ['delete heading and error: red-700 on white', '#b91c1c', '#ffffff'],
    ['delete button: white on red-700', '#ffffff', '#b91c1c'],
    ['disabled delete button: white on gray-500', '#ffffff', '#6b7280'],
    ['explainer button: white on Epyc green', '#ffffff', '#065F46'],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} is at least 4.5:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
