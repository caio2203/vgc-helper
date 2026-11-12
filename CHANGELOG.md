# Changelog

## 0.1.0 (2026-11-12)


### Features

* **api:** accept the deployment's own Vercel URLs as allowed origins ([d8a3de9](https://github.com/caio2203/vgc-helper/commit/d8a3de97dd330e0ef37a117d47fe691cf8e8849b))
* **api:** add NestJS API with deny-by-default auth, sessions, CSRF and snapshot routes ([b49ecdf](https://github.com/caio2203/vgc-helper/commit/b49ecdf35a8879ad75e3c59eab3fa0196ded8a0a))
* **data:** add zod schemas, loaders and the initial Champions M-C snapshot ([fccef25](https://github.com/caio2203/vgc-helper/commit/fccef25c8ba4c04d0502f005c5061961d3ea6b30))
* **engine:** add stat, spread and PP calculations for Stat Points and EV/IV ([04b503d](https://github.com/caio2203/vgc-helper/commit/04b503d5c2a7c0bc896db1188acbc84f737e9574))
* **scripts:** build snapshots from Showdown mods and Smogon usage stats ([a578eb0](https://github.com/caio2203/vgc-helper/commit/a578eb0558e68d8c97e5cbcb7b31fa805c5cfb6f))
* **shared:** add auth, settings and team DTO schemas ([b30ed7f](https://github.com/caio2203/vgc-helper/commit/b30ed7f4d857e9e0df3774b0e54d86d49522f64d))
* **web:** add login, i18n (EN/PT-BR) and a signed-in placeholder with Playwright and axe tests ([df182bf](https://github.com/caio2203/vgc-helper/commit/df182bf5dda05855de54df3ef028dd34a777ba25))


### Bug Fixes

* **api:** explain the empty input from pnpm.ps1 in hash-password ([d31b71e](https://github.com/caio2203/vgc-helper/commit/d31b71e26db82d5259f1f6c7e8b8a8ab149f2bdb))
* **api:** log only warnings and errors in production ([96c22fb](https://github.com/caio2203/vgc-helper/commit/96c22fbfd8c68be89b91e1a5b6fd22a235dfd670))
* **api:** replace @nestjs/throttler with an ESM rate limiter that loads on Vercel ([6edee88](https://github.com/caio2203/vgc-helper/commit/6edee88b09366860ef8cbe7280d78206277463af))
* **deps:** override drizzle-kit's esbuild 0.18 with a patched version ([7e74741](https://github.com/caio2203/vgc-helper/commit/7e74741174ada53220a2482bf1ae84240adfa7c7))
* **scripts:** download only from allowed HTTPS sources and keep the cache inside .cache ([ccbd5a2](https://github.com/caio2203/vgc-helper/commit/ccbd5a251b672dbef2dcf0f044f73aebdfea1e50))
* **shared:** follow the browser language until the user picks one ([a781068](https://github.com/caio2203/vgc-helper/commit/a781068cbf07f77380133af822c9c089d5dfecef))
