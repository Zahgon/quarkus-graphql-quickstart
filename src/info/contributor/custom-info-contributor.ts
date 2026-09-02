/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/** `io.quarkus.info.runtime.spi.InfoContributor` — a named block of `/q/info` data. */
export interface InfoContributor {
  name(): string;
  data(): Record<string, unknown>;
}

export class CustomInfoContributor implements InfoContributor {
  private static readonly MINIO_CONNECTION_STATUS = 'UP';

  name(): string {
    return 'app-detail-info';
  }

  data(): Record<string, unknown> {
    const customData: Record<string, unknown> = {};

    // Sezione Feature Flags
    const featureFlags: Record<string, boolean> = {};
    featureFlags['nuova-dashboard-abilitata'] = this.isNuovaDashboardAbilitata();
    customData['feature-flags'] = featureFlags;

    // Sezione MinIO Connection Status
    const minioInfo: Record<string, unknown> = {};
    minioInfo['status'] = this.getMinIOConnectionStatus();
    customData['minio'] = minioInfo;

    return customData;
  }

  // Metodo di esempio per simulare lo stato del feature flag (invariato)
  private isNuovaDashboardAbilitata(): boolean {
    // Sostituisci con la logica reale
    return true;
  }

  // Metodo di esempio per simulare lo stato della connessione MinIO
  // (invariato, ma da implementare health check reale)
  private getMinIOConnectionStatus(): string {
    // Sostituisci con la logica di health check MinIO reale
    return CustomInfoContributor.MINIO_CONNECTION_STATUS;
  }
}
