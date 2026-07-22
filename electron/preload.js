// Minimal preload. The app runs as a normal web client against the local
// server, so no privileged bridge is exposed yet. Kept for future native
// integrations (printing, file export dialogs, backups).
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("clinva", {
  desktop: true,
  version: process.env.npm_package_version || "",
});
