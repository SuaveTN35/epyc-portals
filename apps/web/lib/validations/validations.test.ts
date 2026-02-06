import { describe, it, expect } from 'vitest';
import {
  distanceRequestSchema,
  createPaymentIntentSchema,
  medicalBrokerPayloadSchema,
  validateRequest,
} from './index';

describe('Validation Schemas', () => {
  describe('distanceRequestSchema', () => {
    it('should accept valid coordinates', () => {
      const validData = {
        origin: { lat: 34.0522, lng: -118.2437 },
        destination: { lat: 33.9425, lng: -118.4081 },
      };

      const result = distanceRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid latitude', () => {
      const invalidData = {
        origin: { lat: 100, lng: -118.2437 }, // lat > 90
        destination: { lat: 33.9425, lng: -118.4081 },
      };

      const result = distanceRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude', () => {
      const invalidData = {
        origin: { lat: 34.0522, lng: -200 }, // lng < -180
        destination: { lat: 33.9425, lng: -118.4081 },
      };

      const result = distanceRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const invalidData = {
        origin: { lat: 34.0522 }, // missing lng
        destination: { lat: 33.9425, lng: -118.4081 },
      };

      const result = distanceRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createPaymentIntentSchema', () => {
    it('should accept valid payment intent data', () => {
      const validData = {
        amount: 5000, // $50.00
        delivery_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createPaymentIntentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject amount below minimum', () => {
      const invalidData = {
        amount: 50, // Less than $1.00
        delivery_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createPaymentIntentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID', () => {
      const invalidData = {
        amount: 5000,
        delivery_id: 'not-a-uuid',
      };

      const result = createPaymentIntentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional metadata', () => {
      const validData = {
        amount: 5000,
        delivery_id: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { source: 'web', campaign: 'promo' },
      };

      const result = createPaymentIntentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('medicalBrokerPayloadSchema', () => {
    const validMedicalPayload = {
      order_id: 'MED-2024-001',
      origin: {
        address: '123 Medical Center Dr',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
      },
      destination: {
        address: '456 Lab Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90002',
      },
    };

    it('should accept valid medical payload', () => {
      const result = medicalBrokerPayloadSchema.safeParse(validMedicalPayload);
      expect(result.success).toBe(true);
    });

    it('should reject missing order_id', () => {
      const invalidData = {
        ...validMedicalPayload,
        order_id: undefined,
      };

      const result = medicalBrokerPayloadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing origin address', () => {
      const invalidData = {
        ...validMedicalPayload,
        origin: {
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
        },
      };

      const result = medicalBrokerPayloadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional specimen data', () => {
      const validData = {
        ...validMedicalPayload,
        specimen: {
          type: 'Blood samples',
          weight_lbs: 2.5,
          temperature_sensitive: true,
          temp_min_f: 35,
          temp_max_f: 45,
        },
      };

      const result = medicalBrokerPayloadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative weight', () => {
      const invalidData = {
        ...validMedicalPayload,
        specimen: {
          weight_lbs: -5,
        },
      };

      const result = medicalBrokerPayloadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest helper', () => {
    it('should return success with parsed data for valid input', () => {
      const result = validateRequest(distanceRequestSchema, {
        origin: { lat: 34.0522, lng: -118.2437 },
        destination: { lat: 33.9425, lng: -118.4081 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.origin.lat).toBe(34.0522);
      }
    });

    it('should return errors for invalid input', () => {
      const result = validateRequest(distanceRequestSchema, {
        origin: { lat: 'invalid' },
        destination: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
