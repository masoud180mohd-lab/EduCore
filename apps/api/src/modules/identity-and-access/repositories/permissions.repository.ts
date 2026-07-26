import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';

export type PermissionRow = {
  readonly id: string;
  readonly code: string;
  readonly description: string;
};

@Injectable()
export class PermissionsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async list(): Promise<ReadonlyArray<PermissionRow>> {
    if (this.pool === null) {
      return [];
    }
    try {
      const result = await this.pool.query<PermissionRow>(
        `SELECT id, code, description
         FROM permissions
         ORDER BY code ASC`,
      );
      return result.rows;
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PermissionsRepository', error, { operation: 'list' });
      return [];
    }
  }
}
