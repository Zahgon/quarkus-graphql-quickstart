/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { FastifyReply } from 'fastify';

import type { Response } from '../../deps/jaxrs.js';
import { APPLICATION_PATH } from '../application.js';

/**
 * Writes a `jakarta.ws.rs.core.Response` out over the HTTP layer.
 *
 * A JAX-RS resource may return either a bare entity — which the runtime
 * serialises with the status the method implies — or a `Response` carrying its
 * own status and headers. This is the second case; the first needs no help.
 */
export function sendResponse(reply: FastifyReply, response: Response): FastifyReply {
  for (const [name, value] of Object.entries(response.headers)) {
    // `Response.created(URI)` takes a URI relative to the application, and the
    // JAX-RS runtime resolves it against the request's base URI before it
    // reaches the wire.
    void reply.header(name, name === 'Location' ? absolute(reply, value) : value);
  }
  const entity = response.entity;
  if (entity === null || entity === undefined) {
    return reply.code(response.status).send();
  }
  return reply.code(response.status).send(entity);
}

/** Resolves `location` against `<scheme>://<host><application path>/`. */
function absolute(reply: FastifyReply, location: string): string {
  const { protocol, host } = reply.request;
  const base = `${protocol}://${host}${APPLICATION_PATH}/`;
  return new URL(location.replace(/^\/+/, ''), base).toString();
}
