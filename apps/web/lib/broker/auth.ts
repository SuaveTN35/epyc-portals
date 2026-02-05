import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { Broker } from '@epyc/shared/types';

interface BrokerAuthResult {
  companyId: string;
  broker: Broker;
  apiKeyId: string;
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function authenticateBroker(
  request: Request
): Promise<BrokerAuthResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    throw new AuthError('API key is empty', 401);
  }

  const keyHash = hashApiKey(apiKey);
  const supabase = getServiceSupabase();

  // Look up API key
  const { data: apiKeyRecord, error: keyError } = await supabase
    .from('api_keys')
    .select('id, company_id, permissions, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (keyError || !apiKeyRecord) {
    throw new AuthError('Invalid API key', 401);
  }

  if (apiKeyRecord.revoked_at) {
    throw new AuthError('API key has been revoked', 401);
  }

  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    throw new AuthError('API key has expired', 401);
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyRecord.id);

  // Look up broker for this company
  const { data: broker, error: brokerError } = await supabase
    .from('brokers')
    .select('*')
    .eq('company_id', apiKeyRecord.company_id)
    .eq('is_active', true)
    .single();

  if (brokerError || !broker) {
    throw new AuthError('No active broker configuration found for this API key', 403);
  }

  return {
    companyId: apiKeyRecord.company_id,
    broker: broker as Broker,
    apiKeyId: apiKeyRecord.id,
  };
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
