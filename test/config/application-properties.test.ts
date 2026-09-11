/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  Config,
  applicationProperties,
  environmentVariableName,
  loadApplicationProperties,
  parseProperties,
} from '../../src/config/application-properties.js';

const SAMPLE = `# a comment
quarkus.http.enable-compression=true
quarkus.http.compress-media-types=application/json,text/plain
quarkus.datasource.db-kind=h2
%prod.quarkus.datasource.db-kind=postgresql
%prod.quarkus.datasource.jdbc.url=\${DB_URL}
%prod.quarkus.minio.secret-key=\${MINIO_USER_SECRET_KEY:fallback-secret}
%dev.quarkus.log.category."it.dontesta.labs.quarkus.graphql.s3.service".level=DEBUG
`;

/**
 * A test the original does not have: SmallRye Config resolved these keys. The
 * properties file carries over unchanged, so the resolution rules it is written
 * against — profile prefixes, `${ENV}` expansion, environment overrides — have
 * to carry over with it.
 */
describe('ApplicationPropertiesTest', () => {
  afterEach(() => {
    delete process.env['DB_URL'];
    delete process.env['QUARKUS_DATASOURCE_DB_KIND'];
  });

  it('parseProperties_readsKeyValueLinesAndSkipsComments', () => {
    const properties = parseProperties(SAMPLE);

    expect(properties.get('quarkus.datasource.db-kind')).toBe('h2');
    expect(properties.get('%prod.quarkus.datasource.db-kind')).toBe('postgresql');
    expect(properties.has('# a comment')).toBe(false);
  });

  it('environmentVariableName_upperSnakeCasesTheKey', () => {
    expect(environmentVariableName('quarkus.minio.access-key')).toBe('QUARKUS_MINIO_ACCESS_KEY');
    expect(environmentVariableName('quarkus.http.ssl.certificate.key-store-file')).toBe(
      'QUARKUS_HTTP_SSL_CERTIFICATE_KEY_STORE_FILE',
    );
  });

  it('get_prefersTheProfiledValueOverThePlainOne', () => {
    const properties = parseProperties(SAMPLE);

    expect(new Config(properties, 'dev').get('quarkus.datasource.db-kind')).toBe('h2');
    expect(new Config(properties, 'prod').get('quarkus.datasource.db-kind')).toBe('postgresql');
  });

  it('get_prefersAnEnvironmentVariableOverEverything', () => {
    process.env['QUARKUS_DATASOURCE_DB_KIND'] = 'mariadb';

    expect(new Config(parseProperties(SAMPLE), 'prod').get('quarkus.datasource.db-kind')).toBe(
      'mariadb',
    );
  });

  it('get_expandsEnvironmentReferencesAndTheirDefaults', () => {
    process.env['DB_URL'] = 'jdbc:postgresql://db:5432/quarkus';
    const config = new Config(parseProperties(SAMPLE), 'prod');

    expect(config.get('quarkus.datasource.jdbc.url')).toBe('jdbc:postgresql://db:5432/quarkus');
    expect(config.get('quarkus.minio.secret-key')).toBe('fallback-secret');
  });

  it('get_isUndefinedForAnAbsentKey', () => {
    const config = new Config(parseProperties(SAMPLE), 'dev');

    expect(config.get('quarkus.minio.url')).toBeUndefined();
    expect(config.getOrDefault('quarkus.minio.url', 'http://localhost:9000')).toBe(
      'http://localhost:9000',
    );
    expect(config.getInt('quarkus.http.port', 8080)).toBe(8080);
    expect(config.getBoolean('quarkus.http.enable-compression', false)).toBe(true);
    expect(config.getList('quarkus.http.compress-media-types')).toEqual([
      'application/json',
      'text/plain',
    ]);
    expect(config.getList('quarkus.http.nothing-here')).toEqual([]);
  });

  it('getQuotedNames_collectsTheProfiledLogCategories', () => {
    const categories = new Config(parseProperties(SAMPLE), 'dev').getQuotedNames(
      'quarkus.log.category.',
      'level',
    );

    expect(categories.get('it.dontesta.labs.quarkus.graphql.s3.service')).toBe('DEBUG');
    expect(new Config(parseProperties(SAMPLE), 'prod').getQuotedNames('quarkus.log.category.', 'level').size).toBe(0);
  });

  it('loadApplicationProperties_readsTheProjectFile', () => {
    const loaded = loadApplicationProperties();

    expect(loaded.banner.path).toBe('quarkus-banner.txt');
    expect(loaded.graphql.rootPath).toBe('api/graphql');
    expect(loaded.datasource.dbKind).toBe('h2');
    expect(loaded.hibernateOrm.databaseGeneration).toBe('drop-and-create');
    expect(loaded.hibernateOrm.sqlLoadScript).toBe('sample_data.sql');
    expect(loaded.http.enableCompression).toBe(true);
    expect(loaded.http.compressMediaTypes).toEqual([
      'application/json',
      'application/xml',
      'text/html',
      'text/plain',
    ]);
    expect(loaded.http.keyStoreFile).toBe('app-keystore.p12');
    // Dev Services territory: no object store address is configured off %prod.
    expect(loaded.minio.url).toBe('');
  });

  it('loadApplicationProperties_switchesTheDatasourceAndTheObjectStoreUnderProd', () => {
    process.env['QUARKUS_PROFILE'] = 'prod';
    process.env['DB_URL'] = 'jdbc:postgresql://postgres:5432/quarkus';
    process.env['MINIO_USER_ACCESS_KEY'] = 'prod-access';
    process.env['MINIO_USER_SECRET_KEY'] = 'prod-secret';
    process.env['APP_KEYSTORE_PASSWORD'] = 'prod-keystore';
    try {
      const loaded = loadApplicationProperties();

      expect(loaded.profile).toBe('prod');
      expect(loaded.datasource.dbKind).toBe('postgresql');
      expect(loaded.datasource.url).toBe('jdbc:postgresql://postgres:5432/quarkus');
      expect(loaded.hibernateOrm.logSql).toBe(false);
      // %prod spells the address out as host + port rather than as a URL.
      expect(loaded.minio.url).toBe('http://minio:9000');
      expect(loaded.minio.accessKey).toBe('prod-access');
      expect(loaded.minio.secretKey).toBe('prod-secret');
      expect(loaded.http.keyStoreFile).toBe('/security/keystore/app-keystore.p12');
      expect(loaded.http.keyStorePassword).toBe('prod-keystore');
      expect(loaded.http.port).toBe(8080);
    } finally {
      delete process.env['QUARKUS_PROFILE'];
      delete process.env['MINIO_USER_ACCESS_KEY'];
      delete process.env['MINIO_USER_SECRET_KEY'];
      delete process.env['APP_KEYSTORE_PASSWORD'];
    }
  });

  it('loadApplicationProperties_raisesTheDevLogCategories', () => {
    process.env['QUARKUS_PROFILE'] = 'dev';
    try {
      const loaded = loadApplicationProperties();

      expect(loaded.profile).toBe('dev');
      expect(loaded.http.port).toBe(8080);
      expect(loaded.log.categories.get('it.dontesta.labs.quarkus.graphql.s3.service')).toBe(
        'DEBUG',
      );
    } finally {
      delete process.env['QUARKUS_PROFILE'];
    }
  });

  it('applicationProperties_isResolvedForTheTestProfile', () => {
    expect(applicationProperties.profile).toBe('test');
    expect(applicationProperties.http.port).toBe(8081);
  });
});
