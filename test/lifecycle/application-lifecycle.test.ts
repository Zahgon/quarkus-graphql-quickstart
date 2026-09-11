/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { get as httpsRequest } from 'node:https';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../../src/app.js';

/** A GET that accepts the application's self-signed certificate. */
function httpsGet(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { rejectUnauthorized: false }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode ?? 0, body });
      });
    });
    request.on('error', reject);
  });
}

/**
 * A test the original does not have.
 *
 * Quarkus owned the application lifecycle: it booted the persistence unit,
 * started Dev Services, published the routes and shut all of it down again.
 * The port does that itself in `createApplication`, so both ends of it — a
 * clean start and a clean stop — are asserted here.
 *
 * The instance under test is its own; the persistence unit it shares with the
 * rest of the suite is reference-counted and outlives it.
 */
describe('ApplicationLifecycleTest', () => {
  it('createApplication_startsServesAndStops', async () => {
    const application = await createApplication();
    const address = await application.listen(0);

    expect(address).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${address}/api/editors/3`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { name: string }).name).toBe('Global Tech Publications');

    await application.close();

    await expect(fetch(`${address}/api/editors/3`)).rejects.toThrow();
  });

  it('listenSecure_servesTheSameRoutesOverTheConfiguredKeyStore', async () => {
    const application = await createApplication();
    await application.listen(0);
    const secureAddress = await application.listenSecure(0);

    expect(secureAddress).toMatch(/^https:\/\/127\.0\.0\.1:\d+$/);

    // The key store is self-signed, so the certificate chain cannot be verified.
    const { statusCode, body } = await httpsGet(`${secureAddress}/api/editors/3`);
    expect(statusCode).toBe(200);
    expect((JSON.parse(body) as { name: string }).name).toBe('Global Tech Publications');

    await application.close();
  });
});
