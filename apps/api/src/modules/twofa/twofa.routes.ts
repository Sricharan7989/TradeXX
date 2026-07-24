import { twoFaDisableSchema, twoFaEnableSchema } from '@tradex/types';
import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { writeAuditLog } from '../../lib/audit';
import { authenticate, requireUser } from '../../middleware/authenticate';

import * as twofaService from './twofa.service';

export default async function twofaRoutes(app: FastifyInstance): Promise<void> {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post('/setup', { preHandler: authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const setup = await twofaService.setupTwoFactor(app.db, user.sub, user.email);
    return reply.send({
      secret: setup.secret,
      otpauth_url: setup.otpauthUrl,
      qr_code_data_url: setup.qrCodeDataUrl,
    });
  });

  typedApp.post(
    '/enable',
    { schema: { body: twoFaEnableSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      const backupCodes = await twofaService.enableTwoFactor(app.db, user.sub, request.body.totp_code);
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: '2FA_ENABLED',
        entityType: 'user',
        entityId: user.sub,
        ipAddress: request.ip,
      });
      return reply.send({ backup_codes: backupCodes });
    },
  );

  typedApp.post(
    '/disable',
    { schema: { body: twoFaDisableSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      await twofaService.disableTwoFactor(app.db, user.sub, request.body.password, request.body.totp_code);
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: '2FA_DISABLED',
        entityType: 'user',
        entityId: user.sub,
        ipAddress: request.ip,
      });
      return reply.send({ message: '2FA disabled' });
    },
  );
}
