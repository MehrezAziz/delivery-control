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
        NODE_ENV: 'production',
      },
    },
  ],
};
