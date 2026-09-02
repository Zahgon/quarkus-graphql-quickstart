import { beforeAll } from 'vitest';

import { quarkusTest } from './application.js';

// `@QuarkusTest` starts the application before the first test of the run; every
// later file joins the instance that is already up.
beforeAll(async () => {
  await quarkusTest();
});
