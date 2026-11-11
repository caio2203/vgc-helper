// Starts the built API, serving the built web app, for the Playwright tests.
// The admin password hash is created here, so no secret or hash lives in the repository.
import { hashPassword } from '../../api/dist/security/password.js';

process.env.ADMIN_PASSWORD_HASH = await hashPassword(process.env.E2E_PASSWORD ?? '');
await import('../../api/dist/main.js');
