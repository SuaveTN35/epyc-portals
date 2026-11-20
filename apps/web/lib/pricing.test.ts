import { describe, it, expect } from 'vitest';
import { calculateQuote, pacificTimeInfo } from '@epyc/shared';
import type { QuoteRequest, ServiceLevel, VehicleType } from '@epyc/shared';

// Rates set 2026-11-20 (competitor check): car $20 + $1.25/mi, min $35;
// SUV $25 + $1.75/mi, min $45; van $45 + $2.25/mi, min $85.
// Priority 1.3x, Rush 1.8x, medical +$15, temperature +$25,
// after hours +$25, weekends +50%.

const WEEKDAY_NOON = new Date('2026-11-18T20:00:00Z'); // Wed 12:00 PM PT
const WEEKDAY_EVENING = new Date('2026-11-19T03:30:00Z'); // Wed 7:30 PM PT
const WEEKDAY_EARLY = new Date('2026-11-18T14:30:00Z'); // Wed 6:30 AM PT
const SATURDAY_NOON = new Date('2026-11-21T20:00:00Z'); // Sat 12:00 PM PT
const SATURDAY_NIGHT = new Date('2026-11-22T05:00:00Z'); // Sat 9:00 PM PT
const SUNDAY_JULY_NOON = new Date('2026-07-19T19:00:00Z'); // Sun 12:00 PM PDT

function req(
  vehicle: VehicleType,
  service_level: ServiceLevel = 'standard',
  extra: Partial<QuoteRequest> = {}
): QuoteRequest {
  return {
    pickup_address: '1 Main St',
    pickup_city: 'Van Nuys',
    pickup_state: 'CA',
    pickup_zip: '91411',
    delivery_address: '2 Main St',
    delivery_city: 'Burbank',
    delivery_state: 'CA',
    delivery_zip: '91502',
    package_weight: 5,
    service_level,
    vehicle_required: vehicle,
    ...extra,
  };
}

function sumOfParts(q: ReturnType<typeof calculateQuote>): number {
  return (
    Math.round(
      (q.base_price +
        q.distance_price +
        q.minimum_adjustment +
        q.weight_surcharge +
        q.rush_surcharge +
        q.weekend_surcharge +
        q.hipaa_surcharge +
        q.temperature_surcharge +
        q.after_hours_surcharge) *
        100
    ) / 100
  );
}

describe('calculateQuote rate table', () => {
  it.each([
    ['car', 10, 35],
    ['car', 20, 45],
    ['car', 40, 70],
    ['suv', 10, 45],
    ['suv', 20, 60],
    ['suv', 40, 95],
    ['van', 10, 85],
    ['van', 20, 90],
    ['van', 40, 135],
  ] as const)('%s, %d miles, standard = $%d', (vehicle, miles, total) => {
    const q = calculateQuote(req(vehicle), miles, { pickupAt: WEEKDAY_NOON });
    expect(q.total_price).toBe(total);
    expect(sumOfParts(q)).toBe(q.total_price);
  });

  it('raises a short trip to the vehicle minimum and shows it', () => {
    const q = calculateQuote(req('van'), 5);
    expect(q.base_price + q.distance_price).toBe(56.25);
    expect(q.minimum_adjustment).toBe(28.75);
    expect(q.total_price).toBe(85);
  });

  it('no minimum adjustment once the miles pass it', () => {
    expect(calculateQuote(req('car'), 20).minimum_adjustment).toBe(0);
  });
});

describe('calculateQuote speed', () => {
  it('priority is 1.3x the trip price', () => {
    const q = calculateQuote(req('car', 'priority'), 20);
    expect(q.rush_surcharge).toBe(13.5);
    expect(q.total_price).toBe(58.5);
  });

  it('rush is 1.8x once, not a 30% surcharge on top of 1.8x', () => {
    const q = calculateQuote(req('car', 'rush'), 10);
    expect(q.total_price).toBe(63); // $35 x 1.8
    expect(q.rush_surcharge).toBe(28);
    expect(sumOfParts(q)).toBe(q.total_price);
  });

  it('scheduled and standard pay no speed charge', () => {
    expect(calculateQuote(req('car', 'scheduled'), 20).rush_surcharge).toBe(0);
    expect(calculateQuote(req('car', 'standard'), 20).rush_surcharge).toBe(0);
  });
});

describe('calculateQuote add-ons', () => {
  it('medical and temperature are flat, not multiplied by rush', () => {
    const q = calculateQuote(
      req('car', 'rush', { is_hipaa: true, requires_temperature_control: true }),
      10
    );
    expect(q.hipaa_surcharge).toBe(15);
    expect(q.temperature_surcharge).toBe(25);
    expect(q.total_price).toBe(63 + 15 + 25);
  });

  it('after hours adds a flat $25 in the evening and early morning (Pacific)', () => {
    expect(calculateQuote(req('car'), 20, { pickupAt: WEEKDAY_EVENING }).after_hours_surcharge).toBe(25);
    expect(calculateQuote(req('car'), 20, { pickupAt: WEEKDAY_EARLY }).after_hours_surcharge).toBe(25);
    const q = calculateQuote(req('car'), 20, { pickupAt: WEEKDAY_NOON });
    expect(q.after_hours_surcharge).toBe(0);
    expect(q.weekend_surcharge).toBe(0);
  });

  it('weekend adds 50% of the trip price (after speed)', () => {
    const q = calculateQuote(req('van'), 20, { pickupAt: SATURDAY_NOON });
    expect(q.weekend_surcharge).toBe(45);
    expect(q.total_price).toBe(135);
    const rush = calculateQuote(req('car', 'rush'), 10, { pickupAt: SATURDAY_NOON });
    expect(rush.weekend_surcharge).toBe(31.5);
    expect(rush.total_price).toBe(94.5);
  });

  it('weekend night pays both', () => {
    const q = calculateQuote(req('car'), 20, { pickupAt: SATURDAY_NIGHT });
    expect(q.weekend_surcharge).toBe(22.5);
    expect(q.after_hours_surcharge).toBe(25);
    expect(q.total_price).toBe(92.5);
    expect(sumOfParts(q)).toBe(q.total_price);
  });

  it('no time charges when the pickup time is not given', () => {
    const q = calculateQuote(req('car'), 20);
    expect(q.after_hours_surcharge).toBe(0);
    expect(q.weekend_surcharge).toBe(0);
  });

  it('driver payout stays 60% of the total', () => {
    const q = calculateQuote(req('van'), 20, { pickupAt: WEEKDAY_NOON });
    expect(q.driver_payout).toBe(54);
  });
});

describe('pacificTimeInfo', () => {
  it('uses Pacific time across daylight saving', () => {
    expect(pacificTimeInfo(WEEKDAY_NOON)).toEqual({ hour: 12, isWeekend: false });
    expect(pacificTimeInfo(SATURDAY_NIGHT)).toEqual({ hour: 21, isWeekend: true });
    expect(pacificTimeInfo(SUNDAY_JULY_NOON)).toEqual({ hour: 12, isWeekend: true });
  });
});
