import { z } from 'zod';

/** Header that carries the CSRF token on every request that changes data. */
export const CSRF_HEADER = 'x-csrf-token';

export const authModeSchema = z.enum(['github', 'local-password']);
export type AuthMode = z.infer<typeof authModeSchema>;

export const authMethodsSchema = z.object({
  mode: authModeSchema,
});
export type AuthMethods = z.infer<typeof authMethodsSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  login: z.string(),
  avatarUrl: z.url().nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  csrfToken: z.string(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const localLoginRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});
export type LocalLoginRequest = z.infer<typeof localLoginRequestSchema>;

/** Error codes the login screen knows how to explain. */
export const loginErrorSchema = z.enum([
  'access_denied',
  'invalid_credentials',
  'oauth_failed',
  'rate_limited',
]);
export type LoginError = z.infer<typeof loginErrorSchema>;
