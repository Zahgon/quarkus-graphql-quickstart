import { baseUrl } from './application.js';

/**
 * The HTTP client the integration tests drive the application with.
 *
 * The original uses REST Assured's `given().when().then()` DSL; this is the
 * same three steps — build a request, send it, assert on the reply — with
 * `fetch` and `expect`. What matters for the port is that the request really
 * goes over HTTP to the running application, so routing, multipart parsing,
 * serialisation and the exception mapper are all exercised.
 */
export interface RestResponse {
  readonly statusCode: number;
  readonly headers: Headers;
  readonly text: string;
}

export function body(response: RestResponse): any {
  return JSON.parse(response.text) as unknown;
}

/** Reads a dotted path with `[n]` indexes, as REST Assured's `body(path, …)` does. */
export function path(response: RestResponse, expression: string): unknown {
  let current: unknown = body(response);
  for (const segment of expression.split('.')) {
    const match = /^([^[]*)((?:\[\d+])*)$/.exec(segment);
    const name = match?.[1] ?? segment;
    if (name !== '') {
      current = (current as Record<string, unknown>)[name];
    }
    for (const index of (match?.[2] ?? '').matchAll(/\[(\d+)]/g)) {
      current = (current as unknown[])[Number(index[1])];
    }
  }
  return current;
}

async function send(pathname: string, init: RequestInit): Promise<RestResponse> {
  const response = await fetch((await baseUrl()) + pathname, init);
  return { statusCode: response.status, headers: response.headers, text: await response.text() };
}

export async function get(pathname: string): Promise<RestResponse> {
  return await send(pathname, { method: 'GET' });
}

export async function post(pathname: string, payload: unknown): Promise<RestResponse> {
  return await send(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function put(pathname: string, payload: unknown): Promise<RestResponse> {
  return await send(pathname, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function del(pathname: string): Promise<RestResponse> {
  return await send(pathname, { method: 'DELETE' });
}

export async function multiPart(
  pathname: string,
  parts: { readonly name: string; readonly value?: string; readonly file?: Blob; readonly filename?: string }[],
): Promise<RestResponse> {
  const form = new FormData();
  for (const part of parts) {
    if (part.file !== undefined) {
      form.append(part.name, part.file, part.filename ?? part.name);
    } else {
      form.append(part.name, part.value ?? '');
    }
  }
  return await send(pathname, { method: 'POST', body: form });
}

/** `POST /api/graphql` with `{"query": "…"}`, the transport the original uses. */
export async function graphql(query: string): Promise<RestResponse> {
  return await post('/api/graphql', { query });
}

/** The same endpoint, with the operation's variables supplied separately. */
export async function graphqlWithVariables(
  query: string,
  variables: Record<string, unknown>,
  operationName?: string,
): Promise<RestResponse> {
  return await post('/api/graphql', { query, variables, operationName });
}
