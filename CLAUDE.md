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
- `npm run supabase:local` — Supabase local de mentira (PGlite + migraciones reales + RLS) en :54321,
  para correr la app completa sin internet hacia Supabase. Variables en `.env.example`; código de acceso 123456.
- `npm run e2e` — recorre el panel, el login por enlace, el cotizador, el pago y la agenda con Chromium (necesita
  `npm run supabase:local` recién iniciado y `next start` en :3300 con `.env.local` apuntando a él). Capturas en
  `e2e/screenshots/`.

## Convenciones
- Código, tablas/columnas y commits en inglés. Textos de interfaz en español de México (`lang="es-MX"`).
- Nombre del producto: solo en `src/config/product.json` (lo leen la app y el correo de acceso). Nunca
  escribirlo a mano en otro lugar.
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
- Clientes: `src/lib/supabase/public.ts` (páginas públicas, rol `anon`), `server.ts` (sesión del usuario por
  cookies, RLS como `authenticated`) y `admin.ts` (secret key, salta RLS: solo después de verificar en el servidor
  quién pide qué).
- Las pruebas y el Supabase local comparten `supabase/local/db.mjs` (stub de Supabase + migraciones).

## Panel y acceso
- Nadie se registra solo (`disable_signup`). El dueño entra con un código de 6 dígitos por correo (o el botón
  del correo → `/auth/confirm`). Si su correo está en `business_invites`, el servidor crea su usuario y un
  trigger en `auth.users` lo vuelve miembro (`business_members`).
- Cada página del panel lee la sesión con `getPanelSession()` (`src/lib/panel/session.ts`) dentro de
  `<Suspense>`; cada Server Action llama `requirePanelBusiness()` y valida con Zod (`src/lib/panel/schemas.ts`).
- Formularios: `useFormAction` (`src/components/panel/use-form-action.ts`) evita que React borre lo escrito
  cuando hay un error; tras guardar, la acción llama `refresh()`.
- Agenda (`/panel/agenda`, primera opción del panel): calendario del mes (`?mes=YYYY-MM&dia=YYYY-MM-DD`, el día
  elegido se guarda con `history.replaceState`) y el día por hora exacta (`slotRows`: cada reserva en su hora y las
  horas libres con "Agregar", que abre `/panel/agenda/nueva?dia=…&horario=…&lugar=…`). Datos: `getAgendaMonth()`
  (`src/lib/panel/agenda-data.ts`); reglas puras en `src/lib/agenda.ts` (estados y cambios permitidos: terminada y
  "no llegó" se pueden deshacer, cancelada no). Recordatorio wa.me al cliente: `src/lib/reminder-message.ts`.
- Reservas manuales (`/panel/agenda/nueva`) y reagendar pasan por `create_manual_booking` / `reschedule_booking`
  (security definer, revisan que sea miembro, bloquean la franja y revisan la hora con `private.places_free`). La
  hora se elige con `TimePicker` (`src/app/panel/agenda/slot-picker.tsx`) sobre `getDaySlots(fecha, reservaQueSeMueve)`. Las
  manuales nacen confirmadas, sin anticipo, con precio del catálogo calculado en el servidor. Estado, notas y saldo
  pagado son updates normales con RLS; fecha y montos no se pueden editar directo.
- Acceso al panel ("Tu negocio" → Acceso al panel): los miembros invitan por correo con `grant_business_access`
  (si ya tiene usuario, entra directo; si no, queda en `business_invites` hasta su primer login), ven la lista con
  `business_access` y quitan con `revoke_business_access` (nadie se quita a sí mismo). Nunca poner correos de
  terceros en migraciones: el repo es público.
- Configuración de Auth como código: `supabase/auth/` (URL del sitio, redirecciones, correo en español, SMTP de
  Resend) se aplica con `.github/workflows/auth-config.yml` vía Management API. El token necesita Auth Config y
  Project Settings en lectura-escritura. Secreto extra: `RESEND_API_KEY`.

## Cotizador (página pública)
- `src/app/[slug]/page.tsx` carga todo con `getBookingData()` (`src/lib/booking-data.ts`) y lo pasa a
  `booking-flow.tsx` (cliente). El cliente calcula precio y horarios con las mismas funciones puras que el
  servidor (`src/lib/quote.ts`, `src/lib/availability.ts`) solo para mostrarlos.
- El resumen oficial lo arma la Server Action `prepareQuote` (`src/app/[slug]/actions.ts`): recibe solo ids y
  datos del cliente (Zod en `src/lib/booking-request.ts`, con honeypot), vuelve a leer la BD y revisa el horario.
- Lugares: cada franja tiene `capacity` lugares; cada servicio ocupa `capacity_units` (reserva = suma, mínimo 1).
- Hora exacta: los lugares de una franja son turnos seguidos (`placeTime`: inicio + duración × lugar ÷ lugares,
  redondeado a 5 min; igual en SQL con `private.place_time`). La reserva guarda `start_place` (primer lugar) y
  `arrival_time`, y ocupa `capacity_units` lugares seguidos. Reglas en `slotsForDate` (`src/lib/availability.ts`) y
  `private.places_free` (las dos iguales): cabe si hay lugares libres en total y ninguna reserva con lugar se
  encima. Las funciones que crean o mueven reservas reciben `start_place` (sin él toman el primero libre).
- Los extras van plegados tras "¿Le agregamos algo a tu auto?" (pedido del dueño: no saturar a quien solo quiere el
  lavado).
- Un servicio principal con `includes_extras` (Full detailing) oculta los extras y `calculateQuote` los ignora.
  Lo ocupado sale de la función `public.slot_places` (solo lugar de inicio y tamaño; las reservas no son públicas).
- Servicios: `area` (exterior/interior) y `car_parts` (partes del auto, `src/lib/car-parts.ts`). La página agrupa los
  extras en pestañas y `CarDiagram` (`src/components/car-diagram.tsx`) ilumina las partes elegidas; el panel los
  acomoda con flechas (`moveService`: orden 10, 20, 30… dentro de cada grupo).
- Explicaciones para el cliente ("¿Qué es esto?"): `services.explainer` elige una de `src/lib/service-explainers.ts`
  (texto simple, pasos con íconos, antes y después) que dibuja `src/components/service-explainer.tsx`. Para agregar
  una, súmala a esa lista con su prueba; no prometer duraciones.
- Antes y después: cada explicación tiene su propia escena en `src/components/explainer-scenes.tsx` (la misma escena
  sucia y limpia, más la herramienta de la manija); TypeScript exige una por explicación. `before-after.tsx` las
  encima con un deslizador (dedo, mouse y teclado). Lo "al azar" (polvo, migajas, grietas) sale de una semilla fija
  para que servidor y navegador dibujen igual. Animaciones `ba-*` en `globals.css`, apagadas con reduced-motion.

## Pagos (Mercado Pago)
- Checkout Pro por REST en `src/lib/mercadopago.ts` (nombres de campos del SDK oficial `mercadopago` 3.x).
  Variables: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y `RESEND_API_KEY` (correo al negocio). Sin
  Mercado Pago, el resumen ofrece WhatsApp.
- El resumen pregunta "¿Cómo quieres pagar?": Efectivo (por defecto) o Tarjeta o transferencia (Mercado Pago; dice
  "Muy pronto" si no está configurado). `bookWithCash` (mismas revisiones que el pago, más máximo 3 reservas futuras
  por celular) llama `create_cash_booking`: confirmada al instante, sin anticipo, aparece en la agenda y manda el
  correo al negocio (`emailBusiness`). La página de la reserva dice "en efectivo el día del servicio".
- `startCheckout` (`src/app/[slug]/actions.ts`): Zod, honeypot y términos; límite por IP
  (`register_booking_attempt`); precio del servidor; aparta 30 min con `create_online_booking` (bloquea la franja
  para que dos clientes no ganen el último lugar) y crea la preferencia, que vence con el apartado.
- Webhook `src/app/api/webhooks/mercadopago/route.ts`: verifica `x-signature` (`src/lib/mercadopago-signature.ts`,
  misma regla que el SDK), vuelve a pedir el pago a Mercado Pago y llama `record_mercadopago_payment` (idempotente;
  confirma si el monto y la moneda cubren lo debido; devuelve si confirmó ahora para mandar el correo una vez).
  La página `/[slug]/reserva/[id]` hace lo mismo con el `payment_id` del regreso.
- Ojo: dentro de un render, Next.js reutiliza lecturas GET idénticas; no vuelvas a leer lo que acabas de cambiar.
- `/api/health` dice si el token funciona y si es de una cuenta de prueba (`mercadoPagoTestAccount`).
- Local: `npm run supabase:local` también imita Mercado Pago (página de pago falsa y webhook firmado) y Resend.
- Producción: webhook en `https://lavado-a-domicilio.vercel.app/api/webhooks/mercadopago`, evento "Pagos".

## Estructura
- `src/app/[slug]/` página pública del negocio · `src/app/panel/` panel del negocio · `src/app/admin/` superadmin
- `src/app/panel/<sección>/` = `page.tsx` (lee datos) + `actions.ts` (Server Actions) + formularios cliente
- `src/components/ui/` componentes de shadcn/ui (copiados del repo oficial; el CLI no tiene red aquí)
- `src/lib/` lógica pura y acceso a datos (+ `*.test.ts`)
- `src/config/product.ts` nombre del producto
- `supabase/migrations/` esquema y datos iniciales · `supabase/tests/` pruebas de esquema y RLS

## Entorno de Claude
- No hay Docker ni Supabase local. Las migraciones se aplican al proyecto en la nube vía GitHub Actions.
- El contenedor tiene bloqueados los dominios de Supabase / Mercado Pago / Vercel / Resend (el dueño no puede
  abrir la red). La documentación de Supabase se puede leer desde
  `raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/`.
- Para revisar el sitio publicado, lanzar el workflow `smoke.yml` (inputs `url` y `expect`) por la API de
  GitHub y leer el log: imprime el texto visible de la página. `/api/health` dice qué variables faltan y si
  la llave secreta funciona (`secretKeyWorks`). Si no llega el correo del panel: workflow `diagnose-login.yml`.
  Vercel ya no reporta sus deploys en GitHub: esperar ~1-2 min después del push y confirmar con `smoke.yml`.
- Cambios con migración: subir primero el commit de la migración, esperar a que `db-migrate.yml` termine bien,
  y luego el código que la usa (si no, la página falla mientras se aplica la migración).
- Para probar la interfaz: `npm run supabase:local`, `npm run build` y `next start` con `.env.local` apuntando al
  Supabase local, y recorrerla con Playwright (Chromium en `/opt/pw-browsers`, sin `playwright install`).
