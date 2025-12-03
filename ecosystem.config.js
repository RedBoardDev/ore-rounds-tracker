module.exports = {
  apps: [
    {
      name: "ore-rounds-tracker",
      script: "./dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env_file: ".env",
    },
  ],
};

