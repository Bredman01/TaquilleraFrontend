# Taquillera · Frontend

Interfaz web de **Taquillera**, una cartelera de eventos pequeños (cine, teatro, conciertos y charlas) con venta de boletas de asiento numerado.

Proyecto integrador del Diplomado en Ingeniería de Software con IA y Sistemas Agénticos (FET). **Grupo 11:** Abilson Rivera Garcia y Bredman Estiven Velez Cortez.

| Repositorio | Qué tiene |
|---|---|
| Este | La interfaz, en Next.js 16 |
| [Taquillera-Backend](https://github.com/Bredman01/Taquillera-Backend) | La API, en NestJS 12 |
| [Taquillera-Arnes](https://github.com/AbilsonRivera/Taquillera-Arnes) | El arnés de Claude Code: agentes, hook, reglas, skills y specs |

## Cómo ejecutarlo

Necesita Node.js 24 y el backend corriendo en `http://localhost:3001`.

```powershell
npm ci
npm run dev    # http://localhost:3000
```

Si el backend está en otra dirección, se indica con `NEXT_PUBLIC_API_URL` en `.env.local`.

## Páginas

| Dirección | Qué muestra |
|---|---|
| `/` | La cartelera, con filtros por categoría, ciudad y fecha (`/?categoria=teatro&ciudad=Neiva&fecha=2026-11-21`) |
| `/eventos/{id}` | El detalle de un evento, con sus funciones agrupadas por día |
| `/funciones/{id}` | Los datos de la función y el mapa de asientos, con la selección y el total |
| `/funciones/{id}/compra?asientos=A1,A2` | El resumen de la compra y el formulario de pago simulado, con la confirmación y su código |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint |
| `npm test` | Pruebas con Vitest y Testing Library |
| `npm run test:cov` | Cobertura; falla por debajo del 80 % de líneas |
| `npm run build` | Compilación de producción; también revisa los tipos |

## El arnés en este repositorio

Un solo sistema de agentes coordina este repositorio y el del backend, porque casi todas las funcionalidades cruzan los dos. Por eso los agentes, el hook de rutas, las reglas y las specs viven en [Taquillera-Arnes](https://github.com/AbilsonRivera/Taquillera-Arnes), y este repositorio se clona dentro como `frontend/`. Aquí están las piezas propias del frontend:

| Pieza | Dónde | Qué es |
|---|---|---|
| Memoria | [`AGENTS.md`](AGENTS.md); [`CLAUDE.md`](CLAUDE.md) lo importa | Stack, comandos, organización, convenciones y lo que el agente no debe hacer |
| Skill `vercel-react-best-practices` | [`.claude/skills/vercel-react-best-practices/`](.claude/skills/vercel-react-best-practices/SKILL.md) | Patrones de rendimiento de React y Next |
| CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Lint, pruebas con cobertura y build en cada pull request |
| Umbral de cobertura | [`vitest.config.ts`](vitest.config.ts) | Mínimo del 80 % de líneas |

### Para qué usamos la skill `vercel-react-best-practices`

El modelo no aplica por su cuenta los patrones de rendimiento de React y de Next: peticiones en cascada, componentes de cliente más grandes de lo necesario o datos sin `Suspense`. La skill es de terceros (Vercel): la revisamos buscando texto oculto y comandos de red, y su versión queda fijada en [`skills-lock.json`](skills-lock.json). La usa el desarrollador del frontend al escribir componentes y carga de datos.

El aspecto de las pantallas sale de otra skill, `guia-visual`, que vive en el arnés porque también la usa el agente que verifica la interfaz.

### Cómo se usa

1. Se clona el arnés y, dentro, este repositorio como `frontend/` (lo hace `scripts/preparar.ps1` del arnés).
2. Se escribe la spec y se crea la rama `feat/NNN-nombre`.
3. Desde la raíz del arnés: `claude --agent taquilla-orquestador` y se le pide ejecutar la spec.
4. En este repositorio trabajan tres agentes, en este orden: `probador-front` escribe las pruebas en rojo (commit `test:`), `desarrollador-front` las pone en verde (commit `feat:`) y `verificador-ui` revisa las páginas en un navegador real. Después pasan el guardián del contrato y el revisor.
5. Una persona revisa, sube la rama, abre el pull request y fusiona con el CI en verde. Ningún agente puede hacer `git push` ni fusionar.

El orden completo, los permisos de cada agente y lo que cambió respecto del diseño del taller están en el [README del arnés](https://github.com/AbilsonRivera/Taquillera-Arnes#readme).

## Calidad y evidencia

| Mecanismo | Dónde se ve |
|---|---|
| CI con cobertura mínima del 80 % | Checks de cada pull request de este repositorio |
| TDD: pruebas antes que código | Historial de cada rama: el commit `test:` va antes del `feat:` |
| Revisión independiente | `specs/NNN-nombre/evidencia/revision.md` en el arnés, y las decisiones en cada pull request |
| Verificación en el navegador | `specs/NNN-nombre/evidencia/ui/` en el arnés: capturas a 390 y 1280 px en tema claro y oscuro, axe-core, consola y recorrido con teclado |
| Contrato con el backend | `specs/NNN-nombre/evidencia/contrato.md` en el arnés |

## Specs que tocaron este repositorio

| Spec | Pull request |
|---|---|
| [001 · Detalle de película](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/001-detalle-pelicula/spec.md) | [#4](https://github.com/Bredman01/TaquilleraFrontend/pull/4) |
| [002 · Eventos y filtros de la cartelera](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/002-eventos-y-filtros/spec.md) | [#5](https://github.com/Bredman01/TaquilleraFrontend/pull/5) |
| [003 · Funciones por evento](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/003-funciones-por-evento/spec.md) | [#6](https://github.com/Bredman01/TaquilleraFrontend/pull/6) |
| [004 · Mapa de asientos](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/004-mapa-de-asientos/spec.md) | [#7](https://github.com/Bredman01/TaquilleraFrontend/pull/7) |
| [005 · Compra con pago simulado](https://github.com/AbilsonRivera/Taquillera-Arnes/blob/main/specs/005-compra-pago-simulado/spec.md) | [#8](https://github.com/Bredman01/TaquilleraFrontend/pull/8) |
