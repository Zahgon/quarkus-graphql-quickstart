/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { logger } from '../../../deps/log.js';
import { Status, WebApplicationException } from '../../../deps/jaxrs.js';

const Log = logger('it.dontesta.labs.quarkus.graphql.ws.mappers.errors');

/**
 * This exception mapper catch all throwable and is the last in the chain
 * because is the most generic one. Remember that only one mapper can be
 * triggered in each exception managing process.
 */
export class GenericExceptionMapper {
  toResponse(exception: unknown): { status: number; body: Record<string, unknown> } {
    Log.error('An error occurred', exception);

    let code: number = Status.INTERNAL_SERVER_ERROR;

    if (exception instanceof WebApplicationException) {
      code = exception.getResponse().getStatus();
    }

    const exceptionJson: Record<string, unknown> = {};
    exceptionJson['code'] = code;
    exceptionJson['exceptionType'] = exceptionTypeOf(exception);

    const message = exception instanceof Error ? exception.message : String(exception);
    if (message !== '') {
      exceptionJson['error'] = message;
    }

    return { status: code, body: exceptionJson };
  }
}

/**
 * The original reports `exception.getClass().getName()`, a fully qualified Java
 * class name. TypeScript has no such thing, so the class's own name is used.
 */
function exceptionTypeOf(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.name === '' ? exception.constructor.name : exception.name;
  }
  return typeof exception;
}
