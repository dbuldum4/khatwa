import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("khatwa", {
  isElectron: true,
});
