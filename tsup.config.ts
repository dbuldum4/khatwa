import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  format: ["cjs"],
  target: "node20",
  platform: "node",
  outDir: "dist-electron",
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["electron"],
});
