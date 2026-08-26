module.exports = {
  apps: [
    {
      name: 'quizzy-api',
      script: 'server.js',
      instances: 'max', // Spawns 1 worker process per CPU core for maximum throughput
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      }
    }
  ]
};
