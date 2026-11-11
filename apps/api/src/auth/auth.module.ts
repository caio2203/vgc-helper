import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GithubAuthGuard, GithubStrategy } from './github.strategy.js';
import { SessionService } from './session.service.js';

@Module({})
export class AuthModule {
  static forRoot(config: AppConfig): DynamicModule {
    const providers: Provider[] = [AuthService, SessionService, GithubAuthGuard];
    // The GitHub strategy exists only when that login method is configured.
    if (config.auth.mode === 'github') providers.push(GithubStrategy);
    return {
      module: AuthModule,
      imports: [PassportModule.register({ session: false })],
      controllers: [AuthController],
      providers,
      exports: [SessionService],
    };
  }
}
