const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

const DEFAULT_PORT = 5000;

function waitForHttpOk(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume(); // Drain data to free memory.
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url} (status ${res.statusCode})`));
          return;
        }
        setTimeout(tick, 250);
      });

      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
    };

    tick();
  });
}

function startBundledServer() {
  // The server entry starts listening immediately when required.
  // We keep a fixed port to avoid needing IPC back from the server code.
  if (!process.env.PORT) process.env.PORT = String(DEFAULT_PORT);
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", "dist", "index.cjs")
    : path.join(app.getAppPath(), "dist", "index.cjs");

  // eslint-disable-next-line global-require, import/no-dynamic-require
  require(serverEntry);
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0f14",
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.removeMenu();

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `http://127.0.0.1:${process.env.PORT || DEFAULT_PORT}/`;

  await waitForHttpOk(startUrl, 20000);
  await win.loadURL(startUrl);
  win.show();
}

app.whenReady().then(async () => {
  try {
    if (app.isPackaged) {
      startBundledServer();
    }
    await createMainWindow();
  } catch (e) {
    // If startup fails, at least print a clear error.
    // eslint-disable-next-line no-console
    console.error(e);
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

