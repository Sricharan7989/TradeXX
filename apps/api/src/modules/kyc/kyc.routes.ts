import { kycSubmitSchema, kycUploadRequestSchema } from '@tradex/types';
import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { env } from '../../env';
import { writeAuditLog } from '../../lib/audit';
import { badRequest } from '../../lib/http-errors';
import { authenticate, requireUser } from '../../middleware/authenticate';

import * as kycService from './kyc.service';

const documentIdParamSchema = z.object({ documentId: z.string().uuid() });

export default async function kycRoutes(app: FastifyInstance): Promise<void> {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/submit',
    { schema: { body: kycSubmitSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      await kycService.submitKyc(app.db, user.sub, request.body);
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: 'KYC_SUBMITTED',
        entityType: 'user_profile',
        entityId: user.sub,
        ipAddress: request.ip,
      });
      return reply.send({ message: 'KYC submitted for review' });
    },
  );

  typedApp.get('/status', { preHandler: authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const status = await kycService.getKycStatus(app.db, user.sub);
    return reply.send(status);
  });

  typedApp.post(
    '/upload',
    { schema: { body: kycUploadRequestSchema }, preHandler: authenticate },
    async (request, reply) => {
      const user = requireUser(request);
      const target = kycService.createUploadTarget();
      await writeAuditLog(app.db, {
        userId: user.sub,
        action: 'KYC_DOCUMENT_UPLOAD_REQUESTED',
        entityType: 'kyc_document',
        entityId: target.documentId,
        metadata: { doc_type: request.body.doc_type, file_name: request.body.file_name },
        ipAddress: request.ip,
      });
      return reply.send({
        upload_url: target.uploadUrl,
        document_id: target.documentId,
        expires_at: target.expiresAt,
      });
    },
  );

  // Separate child encapsulation so the raw-passthrough content-type parser
  // below applies ONLY to this route, never to the JSON-bodied routes above.
  await app.register(async (uploadScope) => {
    uploadScope.addContentTypeParser('*', (_request, payload, done) => {
      done(null, payload);
    });

    const typedUploadScope = uploadScope.withTypeProvider<ZodTypeProvider>();
    typedUploadScope.put(
      '/upload/:documentId',
      {
        schema: { params: documentIdParamSchema },
        preHandler: authenticate,
        bodyLimit: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
      },
      async (request, reply) => {
        requireUser(request);
        const stream = request.body;
        if (!isReadableStream(stream)) {
          throw badRequest('Expected a raw file body');
        }
        await kycService.writeUploadedFile(request.params.documentId, stream);
        return reply.send({ message: 'Uploaded' });
      },
    );
  });
}

function isReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return typeof value === 'object' && value !== null && typeof (value as { pipe?: unknown }).pipe === 'function';
}
