import { defineConfig } from 'vitest/config';

import { PackageOrderSequencer } from './test/support/package-order-sequencer.js';

/**
 * A `@QuarkusTest` suite shares one application instance, and therefore one
 * database and one object store, across every test class. Vitest isolates test
 * files from one another by default, which would give each file its own copy of
 * the seeded database and break the ordering the original suite relies on.
 *
 * `fileParallelism: false` + `isolate: false` + a single thread reproduces the
 * original arrangement: one process, one module registry, one application.
 * `PackageOrderSequencer` then runs the files in the order the JVM ran the test
 * classes — by package path.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    isolate: false,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    sequence: {
      shuffle: false,
      concurrent: false,
      sequencer: PackageOrderSequencer,
    },
    setupFiles: ['./test/support/setup.ts'],
    // `graphql` throws on a schema built by a different copy of itself. Vitest
    // loads the application through Vite and `graphql-ws` through Node, which
    // is two copies; inlining the latter puts both on the same one. Plain Node
    // resolves a single instance and needs no such help.
    server: { deps: { inline: ['graphql-ws'] } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
      reporter: ['text-summary', 'json', 'lcov'],
    },
  },
});
