import esbuild from "esbuild";

await esbuild.build({
  entryPoints: [
    "electron/main.js",
    "electron/database.js",
  ],
  bundle: true,
  platform: "node",
  target: "node20",
  outdir: "dist-electron",
  format: "esm",
  external: [
    "electron",
    "better-sqlite3",
  ],
});

console.log("Electron build concluído.");