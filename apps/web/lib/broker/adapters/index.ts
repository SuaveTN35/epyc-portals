import type { BrokerType } from '@epyc/shared/types';
import type { BrokerAdapter } from './types';
import { GenericAdapter } from './generic';
import { MedicalAdapter } from './medical';
import { LogisticsAdapter } from './logistics';

const adapters: Record<BrokerType, BrokerAdapter> = {
  medical: new MedicalAdapter(),
  logistics: new LogisticsAdapter(),
  b2b_client: new GenericAdapter(),
};

export function getAdapter(brokerType: BrokerType): BrokerAdapter {
  const adapter = adapters[brokerType];
  if (!adapter) {
    throw new Error(`No adapter found for broker type: ${brokerType}`);
  }
  return adapter;
}

export type { BrokerAdapter, NormalizedBrokerJob } from './types';
