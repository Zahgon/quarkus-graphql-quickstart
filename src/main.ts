/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createApplication } from './app.js';
import { applicationProperties, RESOURCES_ROOT } from './config/application-properties.js';

/** `quarkus.banner.path` — printed once, before the application announces itself. */
function printBanner(): void {
  try {
    process.stdout.write(
      readFileSync(resolve(RESOURCES_ROOT, applicationProperties.banner.path), 'utf8'),
    );
  } catch {
    // A missing banner is not a startup failure.
  }
}

printBanner();

const application = await createApplication();
const address = await application.listen();
process.stdout.write(`Listening on ${address} (profile ${applicationProperties.profile})\n`);

try {
  const secureAddress = await application.listenSecure();
  process.stdout.write(`Listening on ${secureAddress}\n`);
} catch (error) {
  process.stdout.write(
    `TLS is disabled: ${error instanceof Error ? error.message : String(error)}\n`,
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void application.close().then(() => process.exit(0));
  });
}
