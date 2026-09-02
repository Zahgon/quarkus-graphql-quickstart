/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The configuration layer, reading `src/main/resources/application.properties`.
 *
 * The file itself carries over unchanged: it is still the place a value is
 * declared, still profile-prefixed with `%prod.` / `%dev.`, and still expands
 * `${ENV_VAR}` references. What is reimplemented here is SmallRye Config's
 * resolution — an environment variable named after the upper-snake-case of the
 * key wins over a profiled value, which wins over the plain one.
 */

/** The active profile: `prod` in production, `test` under the test runner, `dev` otherwise. */
export type Profile = 'dev' | 'test' | 'prod';

function activeProfile(): Profile {
  const explicit = process.env['QUARKUS_PROFILE'];
  if (explicit === 'prod' || explicit === 'dev' || explicit === 'test') {
    return explicit;
  }
  if (process.env['NODE_ENV'] === 'production') {
    return 'prod';
  }
  if (process.env['VITEST'] !== undefined || process.env['NODE_ENV'] === 'test') {
    return 'test';
  }
  return 'dev';
}

/** Parses a `.properties` file: `key=value` lines, `#` comments, no escapes. */
export function parseProperties(text: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('!')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }
    properties.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return properties;
}

/** `quarkus.http.ssl.certificate.key-store-file` → `QUARKUS_HTTP_SSL_CERTIFICATE_KEY_STORE_FILE`. */
export function environmentVariableName(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
}

/** Expands `${VAR}` and `${VAR:default}` against the environment. */
function expand(value: string): string {
  return value.replace(/\$\{([^}:]+)(?::([^}]*))?}/g, (_match, name: string, fallback?: string) => {
    return process.env[name] ?? fallback ?? '';
  });
}

/** A resolved view over the properties file for one profile. */
export class Config {
  constructor(
    private readonly properties: ReadonlyMap<string, string>,
    readonly profile: Profile,
  ) {}

  get(key: string): string | undefined {
    const fromEnvironment = process.env[environmentVariableName(key)];
    if (fromEnvironment !== undefined) {
      return fromEnvironment;
    }
    const raw = this.properties.get(`%${this.profile}.${key}`) ?? this.properties.get(key);
    return raw === undefined ? undefined : expand(raw);
  }

  getOrDefault(key: string, fallback: string): string {
    return this.get(key) ?? fallback;
  }

  getBoolean(key: string, fallback: boolean): boolean {
    const value = this.get(key);
    return value === undefined ? fallback : value === 'true';
  }

  getInt(key: string, fallback: number): number {
    const value = this.get(key);
    return value === undefined ? fallback : Number(value);
  }

  getList(key: string): string[] {
    const value = this.get(key);
    return value === undefined || value === '' ? [] : value.split(',').map((item) => item.trim());
  }

  /** Every `<prefix>"<name>".<suffix>` entry that applies to the active profile. */
  getQuotedNames(prefix: string, suffix: string): Map<string, string> {
    const found = new Map<string, string>();
    const pattern = new RegExp(
      `^(?:%${this.profile}\\.)?${prefix.replace(/\./g, '\\.')}"([^"]+)"\\.${suffix.replace(/\./g, '\\.')}$`,
    );
    for (const [key, value] of this.properties) {
      const match = pattern.exec(key);
      if (match !== null && match[1] !== undefined) {
        found.set(match[1], value);
      }
    }
    return found;
  }
}

export interface ApplicationProperties {
  readonly profile: Profile;
  readonly banner: { readonly path: string };
  readonly http: {
    readonly port: number;
    readonly sslPort: number;
    readonly enableCompression: boolean;
    readonly compressMediaTypes: readonly string[];
    readonly keyStoreFile: string;
    readonly keyStorePassword: string;
  };
  readonly application: { readonly path: string };
  readonly graphql: { readonly rootPath: string };
  readonly datasource: {
    readonly dbKind: string;
    readonly url: string;
    readonly username: string;
    readonly password: string;
    readonly maxSize: number;
  };
  readonly hibernateOrm: {
    readonly databaseGeneration: string;
    readonly sqlLoadScript: string;
    readonly logSql: boolean;
  };
  readonly minio: {
    readonly url: string;
    readonly accessKey: string;
    readonly secretKey: string;
  };
  readonly log: { readonly categories: ReadonlyMap<string, string> };
}

/** Where a classpath resource lives once there is no classpath. */
export const RESOURCES_ROOT = 'src/main/resources';

export function loadApplicationProperties(
  file: string = resolve(RESOURCES_ROOT, 'application.properties'),
): ApplicationProperties {
  const profile = activeProfile();
  const config = new Config(parseProperties(readFileSync(file, 'utf8')), profile);

  // `quarkus.minio.url` is the address as a whole; the properties file spells it
  // out as host + port instead, and outside %prod declares neither — which is
  // what tells the runtime to bring up its own endpoint.
  const minioHost = config.get('quarkus.minio.host');
  const minioPort = config.get('quarkus.minio.port');
  const minioUrl =
    config.get('quarkus.minio.url') ??
    (minioHost === undefined ? '' : `${minioHost}${minioPort === undefined ? '' : `:${minioPort}`}`);

  return {
    profile,
    banner: { path: config.getOrDefault('quarkus.banner.path', 'banner.txt') },
    http: {
      // Quarkus listens on 8080, and on 8081 under @QuarkusTest.
      port: config.getInt('quarkus.http.port', profile === 'test' ? 8081 : 8080),
      sslPort: config.getInt('quarkus.http.ssl-port', profile === 'test' ? 8444 : 8443),
      enableCompression: config.getBoolean('quarkus.http.enable-compression', false),
      compressMediaTypes: config.getList('quarkus.http.compress-media-types'),
      keyStoreFile: config.getOrDefault('quarkus.http.ssl.certificate.key-store-file', ''),
      keyStorePassword: config.getOrDefault(
        'quarkus.http.ssl.certificate.key-store-password',
        '',
      ),
    },
    application: { path: '/api' },
    graphql: { rootPath: config.getOrDefault('quarkus.smallrye-graphql.root-path', 'graphql') },
    datasource: {
      dbKind: config.getOrDefault('quarkus.datasource.db-kind', 'h2'),
      url: config.getOrDefault('quarkus.datasource.jdbc.url', ''),
      username: config.getOrDefault('quarkus.datasource.username', ''),
      password: config.getOrDefault('quarkus.datasource.password', ''),
      maxSize: config.getInt('quarkus.datasource.jdbc.max-size', 20),
    },
    hibernateOrm: {
      databaseGeneration: config.getOrDefault(
        'quarkus.hibernate-orm.database.generation',
        'none',
      ),
      sqlLoadScript: config.getOrDefault('quarkus.hibernate-orm.sql-load-script', ''),
      logSql: config.getBoolean('quarkus.hibernate-orm.log.sql', false),
    },
    minio: {
      url: minioUrl,
      accessKey: config.getOrDefault('quarkus.minio.access-key', 'minioaccess'),
      secretKey: config.getOrDefault('quarkus.minio.secret-key', 'miniosecret'),
    },
    log: { categories: config.getQuotedNames('quarkus.log.category.', 'level') },
  };
}

export const applicationProperties: ApplicationProperties = loadApplicationProperties();
