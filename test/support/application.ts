import { createApplication, type Application } from '../../src/app.js';

/**
 * The single application instance the whole suite runs against.
 *
 * `@QuarkusTest` boots the application once and shares it — and therefore its
 * database and its object store — across every test class. Vitest is
 * configured to run in one worker without isolation, so this module-level
 * singleton is shared the same way.
 */
let booting: Promise<{ application: Application; baseUrl: string }> | null = null;

export function quarkusTest(): Promise<{ application: Application; baseUrl: string }> {
  booting ??= (async () => {
    const application = await createApplication();
    const baseUrl = await application.listen(0);
    return { application, baseUrl };
  })();
  return booting;
}

export async function baseUrl(): Promise<string> {
  return (await quarkusTest()).baseUrl;
}

export async function minioService(): Promise<Application['minioService']> {
  return (await quarkusTest()).application.minioService;
}
