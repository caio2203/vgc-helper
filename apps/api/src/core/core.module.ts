import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { AppConfig } from '../config/env.js';
import { DB, type Db } from '../db/client.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Makes the config and the database available to every module. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(config: AppConfig, db: Db): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DB, useValue: db },
      ],
      exports: [APP_CONFIG, DB],
    };
  }
}
