// Clinva desktop shell.
//
// Boots the bundled Next.js standalone server on a local port against a local
// SQLite database in the user's writable app-data folder, then opens a window
// pointed at it. In development it simply loads the running `next dev` server.
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
let serverProcess = null;
let waWorkerProcess = null;
let waRestartTimer = null;
let mainWindow = null;
let serverPort = 0;

// Prevent renderer/GPU crashes seen on some Windows driver stacks.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

/** Pick a free TCP port on the loopback interface. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Persisted per-install config (auth secret so sessions survive restarts). */
function loadConfig() {
  const file = path.join(app.getPath("userData"), "clinva-config.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    let changed = false;
    if (!parsed.authSecret) {
      parsed.authSecret = crypto.randomBytes(48).toString("base64url");
      changed = true;
    }
    if (!parsed.waAgentSecret) {
      parsed.waAgentSecret = crypto.randomBytes(32).toString("base64url");
      changed = true;
    }
    if (changed) {
      try {
        fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.error("[clinva] could not persist config:", e);
      }
    }
    return parsed;
  } catch {
    const cfg = {
      authSecret: crypto.randomBytes(48).toString("base64url"),
      waAgentSecret: crypto.randomBytes(32).toString("base64url"),
    };
    try {
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    } catch (e) {
      console.error("[clinva] could not persist config:", e);
    }
    return cfg;
  }
}

/** Copy the bundled seed DB into userData on first run; return its path. */
function ensureDatabase() {
  const dbPath = path.join(app.getPath("userData"), "clinva.db");
  if (!fs.existsSync(dbPath)) {
    const seed = path.join(process.resourcesPath, "clinva-seed.db");
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, dbPath);
      console.log("[clinva] initialised database from seed");
    } else {
      console.error("[clinva] seed database missing at", seed);
    }
  }
  return dbPath;
}

/** Wait until the local server answers, or reject after a timeout. */
function waitForServer(port, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/api/health", timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) return resolve();
          retry();
        }
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error("server did not start in time"));
      setTimeout(ping, 400);
    };
    ping();
  });
}

async function startServer() {
  serverPort = await getFreePort();
  const appDir = path.join(process.resourcesPath, "app");
  const serverEntry = path.join(appDir, "server.js");
  const dbPath = ensureDatabase();
  const cfg = loadConfig();

  const env = {
    ...process.env,
    NODE_ENV: "production",
    DESKTOP: "1",
    PORT: String(serverPort),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: "file:" + dbPath.replace(/\\/g, "/"),
    NEXT_PUBLIC_CLINIC: "clinva",
    CLINIC: "clinva",
    AUTH_SECRET: cfg.authSecret,
    WA_AGENT_SECRET: cfg.waAgentSecret,
    WHATSAPP_PROVIDER: "waweb",
    SCHEDULER_ENABLED: "0",
    APP_URL: `http://127.0.0.1:${serverPort}`,
    NEXT_TELEMETRY_DISABLED: "1",
    // Run the bundled Node (Electron binary in node mode), not a UI process.
    ELECTRON_RUN_AS_NODE: "1",
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  serverProcess.on("exit", (code) => {
    console.log("[clinva] server exited", code);
    serverProcess = null;
  });

  await waitForServer(serverPort);
  startWhatsAppWorker(appDir, cfg.waAgentSecret);
}

function startWhatsAppWorker(appDir, waAgentSecret) {
  const workerEntry = path.join(appDir, "worker", "whatsapp-web.mjs");
  if (!fs.existsSync(workerEntry)) {
    console.error("[clinva] whatsapp worker missing at", workerEntry);
    return;
  }

  if (waWorkerProcess && !waWorkerProcess.killed) return;

  const env = {
    ...process.env,
    APP_BASE_URL: `http://127.0.0.1:${serverPort}`,
    WA_AGENT_SECRET: waAgentSecret,
    WA_SESSION_DIR: path.join(app.getPath("userData"), ".wwebjs_auth"),
    WHATSAPP_PROVIDER: "waweb",
    NEXT_PUBLIC_CLINIC: "clinva",
    CLINIC: "clinva",
    ELECTRON_RUN_AS_NODE: "1",
  };

  waWorkerProcess = spawn(process.execPath, [workerEntry], {
    cwd: appDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  waWorkerProcess.stdout.on("data", (d) => process.stdout.write(`[wa] ${d}`));
  waWorkerProcess.stderr.on("data", (d) => process.stderr.write(`[wa] ${d}`));
  waWorkerProcess.on("exit", (code) => {
    console.log("[clinva] whatsapp worker exited", code);
    waWorkerProcess = null;
    if (!app.isQuiting) {
      if (waRestartTimer) clearTimeout(waRestartTimer);
      waRestartTimer = setTimeout(() => startWhatsAppWorker(appDir, waAgentSecret), 3000);
    }
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#f7f5f1",
    title: "Clinva",
    icon: path.join(__dirname, "assets", "icon.ico"),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Open external links (wa.me, maps, social) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target) && !target.startsWith(`http://127.0.0.1:${serverPort}`)) {
      shell.openExternal(target);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.loadURL(url);
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[clinva] renderer crashed:", details);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog.showErrorBox(
      "Clinva",
      "The display process stopped unexpectedly. Clinva will reload automatically."
    );
    mainWindow.reload();
  });
  mainWindow.on("closed", () => (mainWindow = null));
}

function buildMenu() {
  const template = [
    {
      label: "Clinva",
      submenu: [
        { role: "reload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot() {
  buildMenu();
  try {
    if (isDev) {
      serverPort = Number(process.env.CLINVA_DEV_PORT || 3000);
      const url = process.env.ELECTRON_START_URL || `http://localhost:${serverPort}`;
      createWindow(`${url}/dashboard`);
    } else {
      await startServer();
      createWindow(`http://127.0.0.1:${serverPort}/dashboard`);
    }
  } catch (err) {
    console.error("[clinva] failed to start:", err);
    dialog.showErrorBox("Clinva", "The application failed to start.\n\n" + (err && err.message));
    app.quit();
  }
}

// Single-instance: focus the existing window instead of opening a second app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  app.isQuiting = true;
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  if (waRestartTimer) clearTimeout(waRestartTimer);
  if (waWorkerProcess) {
    try {
      waWorkerProcess.kill();
    } catch {}
  }
});

app.on("child-process-gone", (_event, details) => {
  if (details && details.type === "GPU" && details.reason !== "clean-exit") {
    console.error("[clinva] gpu process exited:", details);
  }
});
