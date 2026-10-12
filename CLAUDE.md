# CLAUDE.md

Guía para trabajar en este repo. El alcance completo está en `SPEC.md` (fuente de verdad).

## Cómo trabajar con el dueño
- El dueño no programa y usa el celular. Hablarle en español, en palabras simples.
- Cuando él tenga que hacer algo (cuentas, llaves, configuración), dar pasos exactos, uno por uno.
- Un hito a la vez. Al cerrar un hito: lint + typecheck + tests en verde, commit, link de Vercel,
  lista corta de qué probar. Luego parar y esperar su OK.
- Nada fuera de alcance sin preguntar. Simple antes que ingenioso. Costo cero mientras se pueda.
- Anotar decisiones nuevas en la sección "Decisiones" de `SPEC.md`.

## Stack
Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres, Auth magic link,
Storage, RLS) · Mercado Pago (Checkout Pro, Suscripciones) · Resend · Vercel · Zod · Vitest.

## Convenciones
- Código, nombres de tablas/columnas y commits en inglés. Textos de interfaz en español de México.
- Nombre del producto: solo en `src/config/product.ts`. Nunca escribirlo a mano en otro lugar.
- Dinero: enteros en centavos (`*_cents`) en BD y lógica; formatear con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.
- Fechas: zona `America/Mexico_City`. Fechas de servicio como `date` (sin hora); timestamps como `timestamptz`.
- Multi-negocio: toda tabla de negocio lleva `business_id`; RLS activado en TODAS las tablas.
- Precios, anticipos y disponibilidad se calculan SOLO en el servidor (funciones puras en `src/lib/`
  con tests). Nunca confiar en montos del navegador.
- Validar toda entrada con Zod (server actions y route handlers).
- Secretos solo en variables de entorno del servidor. Nada con `NEXT_PUBLIC_` salvo URL y anon key de Supabase.
- Lógica de negocio en funciones puras y testeables; los componentes solo muestran.
- Webhooks: verificar firma y ser idempotentes.
- Teléfonos: guardar 10 dígitos; para wa.me usar `52` + 10 dígitos.

## Estructura (prevista)
- `src/app/[slug]/` página pública del negocio · `src/app/panel/` panel del negocio · `src/app/admin/` superadmin
- `src/lib/` lógica pura (precios, disponibilidad, folios, wa.me) + `*.test.ts`
- `src/lib/supabase/` clientes de Supabase (server / browser / service role)
- `supabase/migrations/` migraciones SQL versionadas · `supabase/seed.sql` datos de AV Washes

## Comandos
- `npm run dev` — servidor local
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest
- `npm run check` — lint + typecheck + test (correr antes de cada commit)

## Entorno
- No hay Docker ni Supabase local. Las migraciones se aplican al proyecto en la nube.
- El contenedor de Claude puede tener bloqueados los dominios de Supabase / Mercado Pago / Vercel / Resend;
  si falla la red, avisar al dueño qué dominio habilitar en la configuración del entorno.
