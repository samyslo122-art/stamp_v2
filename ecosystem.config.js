module.exports = {
  apps: [
    {
      name: 'event-passport',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'cloudflare-tunnel',
      script: './cloudflared.exe',
      args: 'tunnel --url http://localhost:3000 --protocol http2',
      autorestart: true,
      watch: false,
      error_file: './logs/tunnel-error.log',
      out_file: './logs/tunnel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
