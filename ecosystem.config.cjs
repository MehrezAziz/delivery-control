<<<<<<< HEAD
/**
 * PM2 on the VPS (production):
 *   cd /var/www/delivery-platform/delivery-control   # or your install path
 *   npm ci && npx prisma generate && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Listens on 127.0.0.1:3001 only — expose HTTPS via Nginx (e.g. admin.localsmartdelivery.com).
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  /* optional dep resolution if .env missing */
}

=======
>>>>>>> 2658fd675d6d7c40036fbfc03cdeff63395130b1
module.exports = {
  apps: [
    {
      name: 'delivery-control',
      cwd: __dirname,
      script: 'node',
      args: './node_modules/next/dist/bin/next start -p 3001 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
<<<<<<< HEAD
        ...process.env,
=======
>>>>>>> 2658fd675d6d7c40036fbfc03cdeff63395130b1
        NODE_ENV: 'production',
      },
    },
  ],
};
