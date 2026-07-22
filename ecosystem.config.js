module.exports = {
  apps: [
    {
      name: "bdic",
      // `next start` runs the production server and boots the in-process
      // WhatsApp scheduler (via instrumentation.ts). Reliable with Prisma
      // because the full node_modules (incl. the Prisma engine) are present.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1, // single instance so the cron scheduler runs exactly once
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};

