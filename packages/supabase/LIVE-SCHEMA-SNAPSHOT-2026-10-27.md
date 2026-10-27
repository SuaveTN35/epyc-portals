# Live schema snapshot - Supabase project frdawxvsqckinanypenj - 2026-10-27

Source: information_schema.columns, read-only query. This is the TRUTH; the older
migration files in this folder do not match it. Phase 0 security migration
(20261027000000) is already applied live.

Status CHECK constraints (live):
- deliveries.status: quote_requested, quoted, booked, assigned, en_route_pickup, arrived_pickup, picked_up, en_route_delivery, arrived_delivery, delivered, cancelled, failed
- deliveries.service_level: standard, priority, rush, scheduled
- deliveries.vehicle_required / drivers.vehicle_type: car, suv, van, truck, box_truck
- drivers.background_check_status: pending, approved, rejected
- drivers.loyalty_tier: bronze, silver, gold, platinum
- driver_applications.status: pending_review, contacted, screening, approved, rejected, withdrawn

Storage buckets: driver-documents (private), trust-documents (private). NO delivery-photos bucket.
RLS: proof_of_delivery, driver_locations, delivery_events, temperature_logs, ratings, companies, api_keys have RLS ON with NO policies (all client access denied).
Live trigger guard_driver_protected_fields: non-staff cannot change drivers.background_check_status/date, hipaa_certified/expiry, rating, total_deliveries, loyalty_tier, profile_id.
Live trigger guard_profile_role: only admins (or service role) change profiles.role, except member/customer/client -> driver for self.

## Tables

profiles: id, tenant_id, email, full_name, avatar_url, role, created_at, updated_at, company_name, stripe_customer_id, stripe_connect_id, subscription_plan, phone

drivers: id, profile_id, license_number, license_state, license_expiry, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_plate, insurance_policy, insurance_expiry, background_check_status, background_check_date, hipaa_certified, hipaa_cert_expiry, max_weight_capacity, has_temperature_control, current_lat, current_lng, is_online, rating, total_deliveries, loyalty_tier, created_at, updated_at, vehicle_vin, vehicle_length, vehicle_width, vehicle_height, cargo_capacity, license_front_url, license_back_url, insurance_card_url, registration_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_side_url
(NOT present: status, current_delivery_id, has_cold_storage, last_active_at, user_id, drivers_license_number, drivers_license_expiry, insurance_provider, insurance_policy_number, license_plate, is_hipaa_certified)

deliveries: id, tracking_number, customer_id (NOT NULL), company_id, driver_id, status, pickup_address/city/state/zip (NOT NULL), pickup_lat, pickup_lng, pickup_contact_name, pickup_contact_phone, pickup_instructions, pickup_window_start, pickup_window_end, actual_pickup_time, delivery_address/city/state/zip (NOT NULL), delivery_lat, delivery_lng, delivery_contact_name, delivery_contact_phone, delivery_instructions, delivery_window_start, delivery_window_end, actual_delivery_time, package_description, package_weight, package_length, package_width, package_height, requires_signature, requires_photo_pod, is_fragile, is_medical, is_hipaa, requires_temperature_control, temperature_min, temperature_max, distance_miles, estimated_duration_minutes, base_price, distance_price, weight_surcharge, rush_surcharge, hipaa_surcharge, temperature_surcharge, total_price, driver_payout, tip_amount, service_level, vehicle_required, quoted_at, booked_at, assigned_at, created_at, updated_at
(NOT present: total_amount, scheduled_pickup, description)

delivery_events: id, delivery_id, event_type (NOT NULL), old_status, new_status, lat, lng, notes, created_by, ip_address, user_agent, access_reason, created_at   (NOT present: description)
proof_of_delivery: id, delivery_id, type (signature|photo|barcode|otp|temperature), signature_data, photo_url, barcode_value, otp_code, temperature_reading, recipient_name, recipient_relation, notes, lat, lng, captured_at
driver_locations: id, driver_id, delivery_id, lat, lng, speed, heading, recorded_at
job_offers: id, delivery_id, driver_id, status (pending|accepted|rejected|expired), estimated_payout, distance_to_pickup_miles, expires_at (NOT NULL), responded_at, created_at
driver_applications: id, profile_id, full_name, email, phone, status, profile_photo_path, license_front_path, license_back_path, source, notes, contacted_at, reviewed_by, created_at, updated_at
payments: id, delivery_id, customer_id, stripe_payment_intent_id, stripe_charge_id, amount, tip_amount, status, paid_at, created_at
driver_payouts: id, driver_id, delivery_id, stripe_transfer_id, amount, tip_amount, status, payout_method, paid_at, created_at
temperature_logs: id, delivery_id, driver_id, temperature, lat, lng, recorded_at
ratings: id, delivery_id, rated_by, rated_user, rated_driver, rating, review, created_at
support_tickets: id, delivery_id, created_by, assigned_to, subject, description, priority, status, resolved_at, created_at
notifications: id, user_id, delivery_id, type (sms|email|push), title, message, read, sent_at
companies: id, name, address, city, state, zip, phone, email, billing_email, hipaa_compliant, api_key, created_at, updated_at
brokers: id, company_id, name, type, is_active, auto_accept, auto_accept_max_distance_miles, auto_accept_service_levels, callback_url, callback_headers, callback_events, metadata, created_at, updated_at
broker_deliveries: id, broker_id, delivery_id, broker_job_id, broker_reference, raw_payload, last_status_sent, last_callback_at, last_callback_status, callback_attempts, callback_error, created_at
api_keys: id, company_id, key_hash, name, permissions, last_used_at, expires_at, revoked_at, created_at
