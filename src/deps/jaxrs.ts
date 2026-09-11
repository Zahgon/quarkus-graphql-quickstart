/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
/**
 * The slice of `jakarta.ws.rs` the resources use: the exception hierarchy the
 * mapper keys off, and the `Response` builder they return.
 */

/** `jakarta.ws.rs.core.Response.Status`, limited to the statuses in use. */
export const Status = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** `jakarta.ws.rs.core.Response` — an immutable status + headers + entity triple. */
export class Response {
  private constructor(
    readonly status: number,
    readonly entity: unknown,
    readonly headers: Readonly<Record<string, string>>,
  ) {}

  getStatus(): number {
    return this.status;
  }

  getEntity(): unknown {
    return this.entity;
  }

  getHeaderString(name: string): string | null {
    return this.headers[name] ?? null;
  }

  static ok(entity: unknown): ResponseBuilder {
    return new ResponseBuilder(Status.OK, entity);
  }

  static created(location: string): ResponseBuilder {
    return new ResponseBuilder(Status.CREATED, null, { Location: location });
  }

  /** @internal used by the builder to produce the finished response. */
  static of(
    status: number,
    entity: unknown,
    headers: Readonly<Record<string, string>>,
  ): Response {
    return new Response(status, entity, headers);
  }
}

export class ResponseBuilder {
  constructor(
    private readonly status: number,
    private readonly entity: unknown,
    private readonly headers: Record<string, string> = {},
  ) {}

  header(name: string, value: string): ResponseBuilder {
    return new ResponseBuilder(this.status, this.entity, { ...this.headers, [name]: value });
  }

  build(): Response {
    return Response.of(this.status, this.entity, this.headers);
  }
}

const REASON_PHRASES: Readonly<Record<number, string>> = {
  404: 'Not Found',
  500: 'Internal Server Error',
};

/** `jakarta.ws.rs.WebApplicationException`. */
export class WebApplicationException extends Error {
  readonly status: number;

  constructor(message?: string, status: number = Status.INTERNAL_SERVER_ERROR) {
    // The Java constructor that takes only a status derives its detail message
    // from the response: `HTTP <status> <reason phrase>`.
    super(message ?? `HTTP ${String(status)} ${REASON_PHRASES[status] ?? ''}`.trim());
    this.name = 'WebApplicationException';
    this.status = status;
  }

  getResponse(): { getStatus: () => number } {
    return { getStatus: (): number => this.status };
  }
}

/** `jakarta.ws.rs.NotFoundException`. */
export class NotFoundException extends WebApplicationException {
  constructor(message?: string) {
    super(message, Status.NOT_FOUND);
    this.name = 'NotFoundException';
  }
}
