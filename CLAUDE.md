# CLAUDE.md

Guía para trabajar en este repo. El alcance completo y las decisiones están en `SPEC.md` (fuente de verdad).

@AGENTS.md

## Cómo trabajar con el dueño
- El dueño no programa y usa el celular. Hablarle en español, en palabras simples.
- Cuando él tenga que hacer algo (cuentas, llaves, configuración), dar pasos exactos, uno por uno.
- Un hito a la vez. Al cerrar un hito: `npm run check` en verde, commit, link de Vercel,
  lista corta de qué probar. Luego parar y esperar su OK.
- Nada fuera de alcance sin preguntar. Simple antes que ingenioso. Costo cero mientras se pueda.
- Anotar decisiones nuevas en la sección "Decisiones" de `SPEC.md`.
- Se trabaja directo en `main`: cada push despliega a producción en Vercel y aplica migraciones.
  Por eso nada se sube sin `npm run check` y `npm run build` en verde.

## Stack
Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4 + shadcn/ui · Supabase (Postgres,
Auth magic link, Storage, RLS) · Mercado Pago (Checkout Pro, Suscripciones) · Resend · Vercel · Zod 4 · Vitest.

## Comandos
- `npm run dev` — servidor local (necesita `.env.local`, ver `.env.example`)
- `npm run lint` — ESLint
- `npm run typecheck` — `next typegen && tsc --noEmit`
- `npm test` — Vitest (incluye pruebas de RLS en Postgres en memoria)
- `npm run check` — lint + typecheck + test (correr antes de cada commit)
- `npm run build` — build de producción (lo mismo que corre Vercel)

## Convenciones
- Código, tablas/columnas y commits en inglés. Textos de interfaz en español de México (`lang="es-MX"`).
- Nombre del producto: solo en `src/config/product.ts`. Nunca escribirlo a mano en otro lugar.
- Dinero: enteros en centavos (`*_cents`) en BD y lógica; mostrar con `formatMXN` (`src/lib/money.ts`).
- Fechas: zona `America/Mexico_City`. Días de la semana en formato ISO (1 = lunes … 7 = domingo).
- Multi-negocio: toda tabla de negocio lleva `business_id`; las FK compuestas `(business_id, id)` impiden
  mezclar datos de dos negocios.
- Precios, anticipos y disponibilidad se calculan SOLO en el servidor (funciones puras en `src/lib/` con
  tests). Nunca confiar en montos del navegador.
- Validar toda entrada con Zod (server actions y route handlers).
- Secretos solo en variables de entorno del servidor. Con `NEXT_PUBLIC_` solo la URL y la publishable key
  de Supabase.
- Webhooks: verificar firma y ser idempotentes.
- Teléfonos: guardar 10 dígitos; para wa.me usar `52` + 10 dígitos.

## Next.js 16 (ojo, cambió)
- Leer la guía en `node_modules/next/dist/docs/` antes de usar una API (ver `AGENTS.md`).
- Cache Components está activo: datos por request (params, cookies, consultas frescas) van dentro de
  `<Suspense>`; datos compartidos pueden usar `"use cache"` + `cacheLife`/`cacheTag`.
- `middleware.ts` ahora se llama `proxy.ts`. `next lint` ya no existe (se usa `eslint`).

## Base de datos (Supabase)
- Migraciones en `supabase/migrations/` (SQL, nombre `YYYYMMDDHHMMSS_descripcion.sql`). Nunca editar una
  migración ya aplicada; crear una nueva.
- Cada tabla nueva: `enable row level security` + grants explícitos (`revoke all … from anon, authenticated`
  y luego `grant` solo lo necesario, también a `service_role`). No confiar en los permisos por defecto.
- Funciones auxiliares de RLS en el esquema `private` (no expuesto por la API), `security definer` y
  `set search_path = ''`.
- Las pruebas en `supabase/tests/` corren las migraciones reales en PGlite con un stub mínimo de Supabase
  (roles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`). Usar `asRole()` para probar RLS.
- Al hacer push a `main`, GitHub Actions (`db-migrate.yml`) prueba y aplica las migraciones con
  `supabase db push`. Secretos del repo: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.
- Clientes: `src/lib/supabase/public.ts` (páginas públicas, rol `anon`). Los de sesión de usuario y de
  servidor con secret key se agregan cuando se necesiten (panel, pagos).

## Estructura
- `src/app/[slug]/` página pública del negocio · `src/app/panel/` panel del negocio · `src/app/admin/` superadmin
- `src/lib/` lógica pura y acceso a datos (+ `*.test.ts`)
- `src/config/product.ts` nombre del producto
- `supabase/migrations/` esquema y datos iniciales · `supabase/tests/` pruebas de esquema y RLS

## Entorno de Claude
- No hay Docker ni Supabase local. Las migraciones se aplican al proyecto en la nube vía GitHub Actions.
- El contenedor tiene bloqueados los dominios de Supabase / Mercado Pago / Vercel / Resend (el dueño no puede
  abrir la red). La documentación de Supabase se puede leer desde
  `raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/`.
- Para revisar el sitio publicado, lanzar el workflow `smoke.yml` (inputs `url` y `expect`) por la API de
  GitHub y leer el log: imprime el texto visible de la página.
