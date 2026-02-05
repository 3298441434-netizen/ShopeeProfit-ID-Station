const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "ShopeeProfit ID Station",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
      // preload: path.join(__dirname, "preload.js"),
    }
    // icon: path.join(__dirname, "public/favicon.ico"),
  });

  // 隐藏默认菜单
  mainWindow.setMenuBarVisibility(false);

  // 失败加载日志（白屏必备）
  mainWindow.webContents.on("did-fail-load", (_, code, desc, url) => {
    console.log("did-fail-load", code, desc, url);
  });

  // 开发环境：Vite Dev Server URL
  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // ✅ 生产环境：用 app.getAppPath() 找到打包后的 dist/index.html
    const indexHtml = path.join(app.getAppPath(), "dist", "index.html");
    console.log("Loading:", indexHtml);
    mainWindow.loadFile(indexHtml);

    // 如果你想生产环境也能看控制台，把下一行取消注释
    // mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
