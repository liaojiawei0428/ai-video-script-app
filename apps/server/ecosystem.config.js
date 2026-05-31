module.exports = {
  apps: [
    {
      name: 'ai-script-server',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 6000,
        APP_VERSION: '1.1.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 6000,
        APP_VERSION: '1.1.0',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 6000,
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'data'],
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
