
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

// O build do Electron carrega o app via file://, onde os assets só
// funcionam com caminho RELATIVO ("./assets/..."). O build web (Vercel)
// serve o app a partir da raiz do domínio e agora usa browser history
// (rotas tipo /financeiro/comissoes), então precisa de caminho ABSOLUTO
// ("/assets/...") — senão os assets 404 em qualquer rota que não seja "/".
// Controlado pela env var BUILD_TARGET, setada nos scripts do package.json.
const isElectronBuild = process.env.BUILD_TARGET === "electron";

export default defineConfig({
  base: isElectronBuild ? "./" : "/",

  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  server: {
    port: 5173,
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});