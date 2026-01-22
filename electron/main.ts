import { app, BrowserWindow, shell } from "electron";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";

const isDev = process.env.ELECTRON_DEV === "1";
const devServerUrl = process.env.ELECTRON_START_URL ?? "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;
let staticServer: ReturnType<typeof createServer> | null = null;

// Fixed port for the static server to ensure consistent origin for IndexedDB
const STATIC_SERVER_PORT = 45789;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const getMimeType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
};

const isSafePath = (rootDir: string, filePath: string) => {
  const safeRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  return filePath === rootDir || filePath.startsWith(safeRoot);
};

const resolveRequestPath = async (rootDir: string, requestPath: string) => {
  const filePath = path.resolve(rootDir, `.${requestPath}`);
  if (!isSafePath(rootDir, filePath)) {
    return null;
  }

  const stat = await fs.stat(filePath).catch(() => null);
  if (stat?.isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    return (await fs.stat(indexPath).catch(() => null)) ? indexPath : null;
  }

  if (stat) {
    return filePath;
  }

  const hasExtension = path.extname(filePath).length > 0;
  if (!hasExtension) {
    const indexPath = path.join(rootDir, "index.html");
    return (await fs.stat(indexPath).catch(() => null)) ? indexPath : null;
  }

  return null;
};

const handleStaticRequest = async (
  rootDir: string,
  req: IncomingMessage,
  res: ServerResponse,
) => {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const resolvedPath = await resolveRequestPath(rootDir, requestUrl.pathname);

  if (!resolvedPath) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", getMimeType(resolvedPath));
  createReadStream(resolvedPath).pipe(res);
};

const findOutDir = async () => {
  const candidates = [
    path.join(app.getAppPath(), "out"),
    path.resolve(app.getAppPath(), "..", "out"),
    path.resolve(process.cwd(), "out"),
  ];

  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isDirectory()) {
      return candidate;
    }
  }

  throw new Error(
    "Static export folder not found. Run `pnpm build:electron` before launching the app.",
  );
};

const startStaticServer = async () => {
  const rootDir = await findOutDir();

  staticServer = createServer((req, res) => {
    void handleStaticRequest(rootDir, req, res);
  });

  await new Promise<void>((resolve, reject) => {
    staticServer?.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Port is in use, try with a random port as fallback
        console.warn(
          `Port ${STATIC_SERVER_PORT} is in use, falling back to random port. ` +
          `Note: IndexedDB data may not persist correctly.`
        );
        staticServer?.listen(0, "127.0.0.1", () => resolve());
      } else {
        reject(err);
      }
    });
    staticServer?.listen(STATIC_SERVER_PORT, "127.0.0.1", () => resolve());
  });

  const addressInfo = staticServer.address();
  if (!addressInfo || typeof addressInfo === "string") {
    throw new Error("Failed to start static server.");
  }

  return `http://127.0.0.1:${addressInfo.port}`;
};

const attachExternalLinkHandlers = (window: BrowserWindow, baseUrl: string) => {
  const baseOrigin = new URL(baseUrl).origin;
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const targetOrigin = new URL(url).origin;
    if (targetOrigin !== baseOrigin) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
};

// Background color matching the app's dark theme
const APP_BACKGROUND = "#232323";

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: APP_BACKGROUND,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    attachExternalLinkHandlers(mainWindow, devServerUrl);
    return;
  }

  const serverUrl = await startStaticServer();
  await mainWindow.loadURL(serverUrl);
  attachExternalLinkHandlers(mainWindow, serverUrl);
};

app.whenReady().then(() => {
  void createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  staticServer?.close();
  staticServer = null;
  mainWindow = null;
});
