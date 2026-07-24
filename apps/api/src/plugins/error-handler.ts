import { ERROR_CODES } from '@tradex/types';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

import { isProduction } from '../env';
import { AppError } from '../lib/http-errors';

const STATUS_CODE_TO_ERROR_CODE: Partial<Record<number, (typeof ERROR_CODES)[keyof typeof ERROR_CODES]>> = {
  400: ERROR_CODES.VALIDATION_FAILED,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  423: ERROR_CODES.ACCOUNT_LOCKED,
  429: ERROR_CODES.RATE_LIMITED,
};

/**
 * GLOBAL RULE: no stack traces in prod responses, generic auth-failure
 * messages. Every error response has the shape { error: { code, message,
 * details? } } regardless of what threw.
 */
export default fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    request.log.error({ err: error }, 'request error');

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Validation failed',
          details: error.flatten(),
        },
      });
      return;
    }

    // fastify-type-provider-zod attaches a ZodError-shaped `validation` array
    // to the FastifyError it throws when request schema validation fails.
    if (error.validation) {
      reply.status(400).send({
        error: { code: ERROR_CODES.VALIDATION_FAILED, message: error.message, details: error.validation },
      });
      return;
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    // Covers errors thrown by other plugins (e.g. @fastify/rate-limit's 429)
    // that aren't AppError instances but do carry a meaningful statusCode.
    const code = STATUS_CODE_TO_ERROR_CODE[statusCode] ?? ERROR_CODES.INTERNAL_ERROR;

    reply.status(statusCode).send({
      error: {
        code,
        message: isProduction && statusCode === 500 ? 'Internal server error' : error.message,
      },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: ERROR_CODES.NOT_FOUND, message: 'Route not found' } });
  });
});
