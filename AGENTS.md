<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Taquillera Frontend

Interfaz web del proyecto integrador **Cartelera y venta de boletas** (diplomado FET): muestra la cartelera de eventos pequeños (cine, teatro, conciertos y charlas) y permite comprar boletas. No tiene base de datos propia: todos los datos vienen de la API `Taquillera-Backend` (NestJS, `http://localhost:3001`).

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 (`strict`) · Tailwind CSS 4 · ESLint 9 (`eslint-config-next`) · Vitest 4 + Testing Library.

## Comandos (PowerShell, desde la raíz del repositorio)

```powershell
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo -> http://localhost:3000
npm run build      # compilación de producción (también revisa tipos)
npm run start      # servir la compilación
npm run lint       # ESLint
npm test           # pruebas con Vitest y Testing Library (*.test.ts y *.test.tsx en src/)
npm run test:cov   # cobertura; falla por debajo del 80 % de líneas
```

Para probar contra datos reales, el backend debe estar corriendo (`npm run start:dev` en `Taquillera-Backend`). Antes de dar una tarea por terminada: `npm run lint`, `npm test` y `npm run build` deben pasar. El CI (`.github/workflows/ci.yml`) ejecuta lo mismo, más la cobertura, en cada pull request.

Variables de entorno: `NEXT_PUBLIC_API_URL` (URL del backend; si no existe, usar `http://localhost:3001`). Se definen en `.env.local`, que no se versiona.

## Lo que el agente no deduciría solo

- `next.config.ts` activa **`cacheComponents`** y **`partialPrefetching`**. Con Cache Components, los datos dinámicos (un `fetch` sin caché, `cookies()`, `searchParams`) deben quedar dentro de un `<Suspense>` o en una función con `'use cache'`; si no, el overlay de desarrollo muestra el aviso **blocking-route** y la compilación puede fallar (ver `01-getting-started/08-caching.md`). Lee `node_modules/next/dist/docs/01-app/` antes de escribir carga de datos.
- `layout.tsx` y las páginas reciben tipos globales generados por Next (`LayoutProps<"/">`, `PageProps<"/eventos/[id]">`); en Next 16 `params` y `searchParams` son **Promises** y se usan con `await`.
- Tailwind 4 se carga con `@import "tailwindcss"` en `globals.css` y el loader `@tailwindcss/turbopack`. No existe `tailwind.config.js`; los tokens de tema van en `@theme` dentro de `globals.css`.
- Alias de importación: `@/*` apunta a `src/*`.
- Las pruebas corren en jsdom y no montan Server Components asíncronos: `layout.tsx`, las páginas y `Cartelera.tsx` quedan fuera de la cobertura (`vitest.config.ts`) y se verifican en el navegador. La lógica va en funciones de `src/lib/` y en componentes síncronos, que sí se prueban.
- `next build` también revisa los tipos de los archivos de prueba: una prueba que no coincide con el código rompe la compilación.
- La skill `vercel-react-best-practices` (`.claude/skills/`) aplica al escribir o revisar componentes y carga de datos.
- Los filtros de la cartelera viajan en la dirección (`/?categoria=teatro&ciudad=Neiva`) y se leen en el servidor con las funciones de `src/lib/cartelera.ts`. Un valor desconocido o repetido cuenta como «Todas»; el formulario es un `<form>` de tipo GET que funciona sin JavaScript.
- El aspecto de las pantallas sale de la skill `guia-visual` del arnés: no se inventan colores, tamaños ni piezas nuevas sin agregarlas ahí.

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
  **/*.test.ts(x)         pruebas, junto al archivo que prueban
public/                   imágenes y archivos estáticos
```

Dependencias permitidas: `app -> components -> lib`. Los componentes no llaman a `fetch` directamente: usan funciones de `src/lib/`. Los tipos de datos de la API se declaran una sola vez en `src/lib/` y deben coincidir con lo que responde el backend.

Usa Server Components por defecto. Agrega `'use client'` solo cuando el componente necesite estado, efectos o eventos del navegador, y en el componente más pequeño posible.

## Convenciones

- **Idioma:** la interfaz va en español. Rutas y tipos del dominio en español (`/eventos`, `Evento`), igual que en el backend.
- **Nombres:** componentes en PascalCase (`EventoCard.tsx`), utilidades en camelCase, carpetas de rutas en minúsculas con guiones.
- **Estilo:** clases de Tailwind en el JSX; sin CSS por componente salvo que Tailwind no alcance. Soporta modo oscuro con las variantes `dark:` como la plantilla.
- **Imágenes:** usa `next/image`; si se cargan de un dominio externo, ese dominio se agrega en `images.remotePatterns` de `next.config.ts` (y solo eso).
- **Accesibilidad:** texto `alt` en imágenes, encabezados en orden, enlaces con texto que se entienda solo.
- **Pruebas:** cada función nueva de `src/lib/` y cada componente nuevo trae su prueba, incluido el caso de error. Se busca por rol o por texto visible, y `fetch` se simula con `vi.fn()`: ninguna prueba llama al backend real.
- **Ramas:** se trabaja en ramas desde `main` (`feat/...`, `fix/...`, `chore/...`) y se llega a `main` solo por pull request.
- **Commits:** Conventional Commits en español: `feat: cartelera de eventos`, `fix: ...`, `chore: ...`, `docs: ...`.

## Lo que el agente no debe hacer

- No hacer commit ni push directo a `main`, ni fusionar pull requests.
- No crear ni modificar archivos `.env*` ni subir secretos.
- No editar `.next/`, `node_modules/` ni `package-lock.json` a mano.
- No borrar el bloque `nextjs-agent-rules` del inicio de este archivo (lo regenera `next dev`).
- No cambiar `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` ni `vitest.config.ts` salvo lo indicado arriba o cuando se pida.
- No agregar dependencias (librerías de UI, de estado, de fetching) sin explicar por qué en el plan.
- No inventar datos en las páginas: si la API no tiene un campo, se pide en el backend.
