import { updateSettingsSchema } from '@tradex/types';
import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { writeAuditLog } from '../../lib/audit';
import { authenticate, requireUser } from '../../middleware/authenticate';

import * as meService from './me.service';

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get('/', { preHandler: authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const me = await meService.getMe(app.db, user.sub);
    return reply.send(me);
  });

  typedApp.patch(
    '/settings',
    { schema: { body: updateSettingsSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      await meService.updateSettings(app.db, user.sub, request.body);
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: 'SETTINGS_UPDATED',
        entityType: 'user_settings',
        entityId: user.sub,
        metadata: request.body,
        ipAddress: request.ip,
      });
      return reply.send({ message: 'Settings updated' });
    },
  );
}
