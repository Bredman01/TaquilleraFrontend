<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Taquillera Frontend

Interfaz web del proyecto integrador **Cartelera y venta de boletas** (diplomado FET): muestra la cartelera y permite comprar boletas. No tiene base de datos propia: todos los datos vienen de la API `Taquillera-Backend` (NestJS, `http://localhost:3001`).

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 (`strict`) · Tailwind CSS 4 · ESLint 9 (`eslint-config-next`).

## Comandos (PowerShell, desde la raíz del repositorio)

```powershell
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo -> http://localhost:3000
npm run build      # compilación de producción (también revisa tipos)
npm run start      # servir la compilación
npm run lint       # ESLint
```

Para probar contra datos reales, el backend debe estar corriendo (`npm run start:dev` en `Taquillera-Backend`). Antes de dar una tarea por terminada: `npm run lint` y `npm run build` deben pasar. Aún no hay framework de pruebas; no instales uno sin que se pida.

Variables de entorno: `NEXT_PUBLIC_API_URL` (URL del backend; si no existe, usar `http://localhost:3001`). Se definen en `.env.local`, que no se versiona.

## Lo que el agente no deduciría solo

- `next.config.ts` activa **`cacheComponents`** y **`partialPrefetching`**. Con Cache Components, los datos dinámicos (un `fetch` sin caché, `cookies()`, `searchParams`) deben quedar dentro de un `<Suspense>` o en una función con `'use cache'`; si no, el overlay de desarrollo muestra el aviso **blocking-route** y la compilación puede fallar (ver `01-getting-started/08-caching.md`). Lee `node_modules/next/dist/docs/01-app/` antes de escribir carga de datos.
- `layout.tsx` y las páginas reciben tipos globales generados por Next (`LayoutProps<"/">`, `PageProps<"/peliculas/[id]">`); en Next 16 `params` y `searchParams` son **Promises** y se usan con `await`.
- Tailwind 4 se carga con `@import "tailwindcss"` en `globals.css` y el loader `@tailwindcss/turbopack`. No existe `tailwind.config.js`; los tokens de tema van en `@theme` dentro de `globals.css`.
- Alias de importación: `@/*` apunta a `src/*`.
- La skill `vercel-react-best-practices` (`.claude/skills/`) aplica al escribir o revisar componentes y carga de datos.

## Organización del código

```
src/
  app/                    rutas (App Router). Cada carpeta es un segmento de URL.
    layout.tsx            layout raíz (lang="es", fuentes, metadata)
    page.tsx              inicio
    <ruta>/page.tsx       páginas; Server Components por defecto
    <ruta>/loading.tsx    estado de carga; error.tsx para errores
  components/             componentes de UI reutilizables (PascalCase.tsx)
  lib/                    acceso a la API y utilidades (api.ts, tipos compartidos)
public/                   imágenes y archivos estáticos
```

Dependencias permitidas: `app -> components -> lib`. Los componentes no llaman a `fetch` directamente: usan funciones de `src/lib/`. Los tipos de datos de la API se declaran una sola vez en `src/lib/` y deben coincidir con lo que responde el backend.

Usa Server Components por defecto. Agrega `'use client'` solo cuando el componente necesite estado, efectos o eventos del navegador, y en el componente más pequeño posible.

## Convenciones

- **Idioma:** la interfaz va en español. Rutas y tipos del dominio en español (`/peliculas`, `Pelicula`), igual que en el backend.
- **Nombres:** componentes en PascalCase (`PeliculaCard.tsx`), utilidades en camelCase, carpetas de rutas en minúsculas con guiones.
- **Estilo:** clases de Tailwind en el JSX; sin CSS por componente salvo que Tailwind no alcance. Soporta modo oscuro con las variantes `dark:` como la plantilla.
- **Imágenes:** usa `next/image`; si se cargan de un dominio externo, ese dominio se agrega en `images.remotePatterns` de `next.config.ts` (y solo eso).
- **Accesibilidad:** texto `alt` en imágenes, encabezados en orden, enlaces con texto que se entienda solo.
- **Ramas:** se trabaja en ramas desde `main` (`feat/...`, `fix/...`, `chore/...`) y se llega a `main` solo por pull request.
- **Commits:** Conventional Commits en español: `feat: página de cartelera`, `fix: ...`, `chore: ...`, `docs: ...`.

## Lo que el agente no debe hacer

- No hacer commit ni push directo a `main`, ni fusionar pull requests.
- No crear ni modificar archivos `.env*` ni subir secretos.
- No editar `.next/`, `node_modules/` ni `package-lock.json` a mano.
- No borrar el bloque `nextjs-agent-rules` del inicio de este archivo (lo regenera `next dev`).
- No cambiar `next.config.ts`, `tsconfig.json` ni `eslint.config.mjs` salvo lo indicado arriba o cuando se pida.
- No agregar dependencias (librerías de UI, de estado, de fetching) sin explicar por qué en el plan.
- No inventar datos en las páginas: si la API no tiene un campo, se pide en el backend.
