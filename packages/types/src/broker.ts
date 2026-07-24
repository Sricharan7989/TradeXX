import { z } from 'zod';

import { BROKER_PROVIDER } from './enums';

// Populated later (Phase 3+ wires up real broker OAuth); the shape is defined
// now so the DB/API contracts don't churn later.
export const brokerConnectionDto = z.object({
  id: z.string().uuid(),
  provider: z.enum(BROKER_PROVIDER),
  is_active: z.boolean(),
  connected_at: z.string().datetime().nullable(),
  token_expires_at: z.string().datetime().nullable(),
});
export type BrokerConnectionDto = z.infer<typeof brokerConnectionDto>;
