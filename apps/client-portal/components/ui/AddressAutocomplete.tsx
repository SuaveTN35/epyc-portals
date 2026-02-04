'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { usePlacePredictions } from '@/lib/hooks/useGoogleMaps';

// Local debounce to avoid type constraint issues
function debounce<T extends (...args: string[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

interface AddressData {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (data: AddressData) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AddressAutocomplete({
  id,
  label,
  placeholder = 'Enter an address',
  value,
  onChange,
  onAddressSelect,
  error,
  required = false,
  disabled = false,
  className = '',
}: AddressAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    predictions,
    loading,
    searchPlaces,
    getPlaceDetails,
    clearPredictions,
    isLoaded,
  } = usePlacePredictions();

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((input: string) => {
      if (input.length >= 3) {
        searchPlaces(input);
        setShowDropdown(true);
      } else {
        clearPredictions();
        setShowDropdown(false);
      }
    }, 300),
    [searchPlaces, clearPredictions]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedSearch(newValue);
    setSelectedIndex(-1);
  };

  const handleSelectPrediction = async (placeId: string) => {
    const details = await getPlaceDetails(placeId);

    if (details) {
      onChange(details.address);
      onAddressSelect({
        address: details.address,
        city: details.city,
        state: details.state,
        zip: details.zip,
        lat: details.lat,
        lng: details.lng,
      });
    }

    setShowDropdown(false);
    clearPredictions();
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelectPrediction(predictions[selectedIndex].placeId);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        clearPredictions();
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    onChange('');
    clearPredictions();
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const showLoadingState = loading && value.length >= 3;
  const showNoResults = !loading && showDropdown && predictions.length === 0 && value.length >= 3;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className={`h-5 w-5 ${isFocused ? 'text-epyc-primary' : 'text-gray-400'}`} />
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (predictions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={isLoaded ? placeholder : 'Loading maps...'}
          disabled={disabled || !isLoaded}
          required={required}
          autoComplete="off"
          className={`
            w-full pl-10 pr-10 py-2 border rounded-lg transition-colors
            ${error
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 focus:ring-epyc-primary focus:border-epyc-primary'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
        />

        {/* Loading/Clear indicator */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {showLoadingState ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : value.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() => handleSelectPrediction(prediction.placeId)}
              className={`
                w-full px-4 py-3 text-left flex items-start gap-3 transition-colors
                ${index === selectedIndex
                  ? 'bg-epyc-primary/10'
                  : 'hover:bg-gray-50'
                }
                ${index !== 0 ? 'border-t border-gray-100' : ''}
              `}
            >
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {prediction.mainText}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {prediction.secondaryText}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showNoResults && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
          No addresses found. Try a different search.
        </div>
      )}

      {/* Not loaded message */}
      {!isLoaded && !disabled && (
        <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading Google Maps...
        </p>
      )}
    </div>
  );
}
