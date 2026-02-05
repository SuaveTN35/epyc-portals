'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface UseGoogleMapsOptions {
  libraries?: ('places' | 'geometry' | 'drawing' | 'visualization')[];
}

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  loadError: Error | null;
  google: typeof google | null;
}

// Singleton loader to prevent multiple loads
let loaderInstance: Loader | null = null;
let loadPromise: Promise<typeof google> | null = null;

export function useGoogleMaps(options: UseGoogleMapsOptions = {}): UseGoogleMapsReturn {
  const { libraries = ['places'] } = options;
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [googleInstance, setGoogleInstance] = useState<typeof google | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setLoadError(new Error('Google Maps API key is not configured'));
      return;
    }

    // Check if already loaded
    if (window.google?.maps) {
      setGoogleInstance(window.google);
      setIsLoaded(true);
      return;
    }

    // Create or reuse loader
    if (!loaderInstance) {
      loaderInstance = new Loader({
        apiKey,
        version: 'weekly',
        libraries,
      });
    }

    // Create or reuse load promise
    if (!loadPromise) {
      loadPromise = loaderInstance.load();
    }

    loadPromise
      .then((google) => {
        setGoogleInstance(google);
        setIsLoaded(true);
      })
      .catch((error) => {
        setLoadError(error);
      });
  }, [libraries]);

  return { isLoaded, loadError, google: googleInstance };
}

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface PlaceDetails {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface UseAddressAutocompleteOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPlaceSelect?: (place: PlaceDetails) => void;
  country?: string;
  types?: string[];
}

export function useAddressAutocomplete({
  inputRef,
  onPlaceSelect,
  country = 'us',
  types = ['address'],
}: UseAddressAutocompleteOptions) {
  const { isLoaded, google } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!isLoaded || !google || !inputRef.current) return;

    // Initialize autocomplete
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country },
      types,
      fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
    });

    autocompleteRef.current = autocomplete;

    // Listen for place selection
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry?.location || !place.address_components) {
        return;
      }

      const details = parseAddressComponents(
        place.address_components,
        place.formatted_address || '',
        place.geometry.location.lat(),
        place.geometry.location.lng()
      );

      onPlaceSelect?.(details);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [isLoaded, google, inputRef, onPlaceSelect, country, types]);

  return { isLoaded };
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[],
  formattedAddress: string,
  lat: number,
  lng: number
): PlaceDetails {
  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let zip = '';

  for (const component of components) {
    const type = component.types[0];

    switch (type) {
      case 'street_number':
        streetNumber = component.long_name;
        break;
      case 'route':
        route = component.long_name;
        break;
      case 'locality':
        city = component.long_name;
        break;
      case 'administrative_area_level_1':
        state = component.short_name;
        break;
      case 'postal_code':
        zip = component.long_name;
        break;
    }
  }

  const address = streetNumber && route
    ? `${streetNumber} ${route}`
    : route || formattedAddress.split(',')[0];

  return {
    address,
    city,
    state,
    zip,
    lat,
    lng,
    formattedAddress,
  };
}

// Hook for getting predictions manually (for custom UI)
export function usePlacePredictions() {
  const { isLoaded, google } = useGoogleMaps();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!isLoaded || !google) return;

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, [isLoaded, google]);

  const searchPlaces = useCallback(
    async (input: string): Promise<PlacePrediction[]> => {
      if (!autocompleteServiceRef.current || !sessionTokenRef.current || !input.trim()) {
        setPredictions([]);
        return [];
      }

      setLoading(true);

      try {
        const response = await autocompleteServiceRef.current.getPlacePredictions({
          input,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: 'us' },
          types: ['address'],
        });

        const results: PlacePrediction[] = (response.predictions || []).map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text || '',
        }));

        setPredictions(results);
        return results;
      } catch (error) {
        setPredictions([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      if (!google || !placeId) return null;

      const placesService = new google.maps.places.PlacesService(
        document.createElement('div')
      );

      return new Promise((resolve) => {
        placesService.getDetails(
          {
            placeId,
            fields: ['address_components', 'formatted_address', 'geometry'],
            sessionToken: sessionTokenRef.current!,
          },
          (place, status) => {
            // Reset session token after place details are fetched
            sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

            if (status !== 'OK' || !place?.geometry?.location || !place.address_components) {
              resolve(null);
              return;
            }

            const details = parseAddressComponents(
              place.address_components,
              place.formatted_address || '',
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );

            resolve(details);
          }
        );
      });
    },
    [google]
  );

  const clearPredictions = useCallback(() => {
    setPredictions([]);
  }, []);

  return {
    predictions,
    loading,
    searchPlaces,
    getPlaceDetails,
    clearPredictions,
    isLoaded,
  };
}
