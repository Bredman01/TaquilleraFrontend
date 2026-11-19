import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Resuelve el alias @/* de tsconfig.json. Requiere Vite 8, que trae esta opción.
  resolve: { tsconfigPaths: true },
  test: {
    // Sin globals: las pruebas importan describe, it, expect y vi de "vitest".
    globals: false,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      // Mide todo src/, no solo los archivos que alguna prueba importa.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Las pruebas no cuentan como código a cubrir.
        "src/**/*.test.{ts,tsx}",
        // Solo los ejecuta Next (layout carga next/font/google y pinta <html>); los recorre el verificador-ui.
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        // Server Component asíncrono: Vitest no lo monta.
        "src/components/Cartelera.tsx",
      ],
      reporter: ["text", "json-summary"],
      // Piso, no meta: el CI falla por debajo del 80 % de líneas.
      thresholds: { lines: 80 },
    },
  },
});
