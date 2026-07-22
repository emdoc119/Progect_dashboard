module.exports = {
  apps: [
    {
      name: 'progect-dashboard',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false
    }
  ]
};
