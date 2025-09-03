module.exports = {
  apps: [{
    name: 'panda-app-server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
      // ⚠️ IMPORTANTE: NO especificar PORT para hosting compartido
      // El hosting asignará automáticamente el puerto
    }
  }]
};
