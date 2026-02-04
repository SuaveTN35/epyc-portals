import { NextRequest, NextResponse } from 'next/server';

interface DistanceRequest {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
}

interface DistanceResponse {
  distance_miles: number;
  duration_minutes: number;
  distance_text: string;
  duration_text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DistanceRequest = await request.json();

    // Validate request body
    if (
      !body.origin?.lat ||
      !body.origin?.lng ||
      !body.destination?.lat ||
      !body.destination?.lng
    ) {
      return NextResponse.json(
        { error: 'Invalid request: origin and destination coordinates required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Fallback to Haversine formula if no API key
      const distance = calculateHaversineDistance(
        body.origin.lat,
        body.origin.lng,
        body.destination.lat,
        body.destination.lng
      );

      // Estimate duration: average 25 mph in LA traffic
      const durationMinutes = Math.round((distance / 25) * 60);

      return NextResponse.json({
        distance_miles: Math.round(distance * 10) / 10,
        duration_minutes: durationMinutes,
        distance_text: `${Math.round(distance * 10) / 10} mi`,
        duration_text: formatDuration(durationMinutes),
        source: 'haversine',
      });
    }

    // Use Google Distance Matrix API
    const origins = `${body.origin.lat},${body.origin.lng}`;
    const destinations = `${body.destination.lat},${body.destination.lng}`;

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origins);
    url.searchParams.set('destinations', destinations);
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('traffic_model', 'best_guess');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Distance Matrix API error:', data);

      // Fallback to Haversine
      const distance = calculateHaversineDistance(
        body.origin.lat,
        body.origin.lng,
        body.destination.lat,
        body.destination.lng
      );
      const durationMinutes = Math.round((distance / 25) * 60);

      return NextResponse.json({
        distance_miles: Math.round(distance * 10) / 10,
        duration_minutes: durationMinutes,
        distance_text: `${Math.round(distance * 10) / 10} mi`,
        duration_text: formatDuration(durationMinutes),
        source: 'haversine_fallback',
      });
    }

    const element = data.rows[0]?.elements[0];

    if (!element || element.status !== 'OK') {
      return NextResponse.json(
        { error: 'Unable to calculate distance between locations' },
        { status: 400 }
      );
    }

    // Distance is in meters, convert to miles
    const distanceMiles = element.distance.value / 1609.344;

    // Duration in traffic (seconds to minutes)
    const durationSeconds = element.duration_in_traffic?.value || element.duration.value;
    const durationMinutes = Math.round(durationSeconds / 60);

    const result: DistanceResponse = {
      distance_miles: Math.round(distanceMiles * 10) / 10,
      duration_minutes: durationMinutes,
      distance_text: element.distance.text,
      duration_text: element.duration_in_traffic?.text || element.duration.text,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Distance calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate distance' },
      { status: 500 }
    );
  }
}

// Haversine formula for straight-line distance
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Multiply by 1.3 to approximate driving distance (roads aren't straight)
  return distance * 1.3;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}
