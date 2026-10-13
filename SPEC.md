# SPEC — MVP de cotizador, reservas con anticipo y membresías

> Documento original del dueño del producto. Es la fuente de verdad del alcance.
> Cambios de alcance se anotan al final en "Decisiones".

## Quién soy y qué necesito
Tengo un lavado de autos a domicilio en Zapopan, Jalisco (JB's Bros; antes se llamaba AV Washes): lavado exterior, aspirado interior, cera y pulido, con precio según el tipo de vehículo. Hoy cotizo a mano por WhatsApp, no cobro anticipo y algunos clientes no se presentan.

No sé programar. Explícame todo en palabras simples. Cuando yo tenga que hacer algo (crear cuentas, copiar llaves, configurar Mercado Pago, Supabase o Vercel), dame los pasos exactos, uno por uno. Manejo casi todo desde el celular.

Primero lo usará mi negocio y después lo venderé a otros lavadores y detalladores a domicilio en México. Por eso la base de datos debe ser multi-negocio desde el día uno, aunque al inicio solo exista el mío.

El producto tiene dos partes:
1. Cotizador + reserva con anticipo: el cliente elige vehículo y servicios, ve el precio al instante, elige fecha y franja, paga un anticipo con Mercado Pago y confirma por WhatsApp.
2. Membresías: el cliente paga una suscripción mensual (ej. 2 lavados al mes) y reserva con sus créditos, sin anticipo.

## Cómo trabajar
- Guarda este documento como SPEC.md y crea un CLAUDE.md con las convenciones y comandos del proyecto.
- Antes de programar, hazme como máximo 5 preguntas que de verdad bloqueen y propón un plan por hitos. Espera mi OK.
- Para los datos de mi negocio, pídeme:
  - WhatsApp del negocio.
  - Tipos de vehículo (uso 3 en mi tarjeta de precios).
  - Servicios y precios por tipo de vehículo.
  - Zonas y recargos.
  - Franjas y cupo por franja.
  - Porcentaje de anticipo.
  Si te mando foto de mi tarjeta de precios, sácalos de ahí. Lo que falte, ponlo como ejemplo marcado TODO.
- Trabaja un hito a la vez. Al terminar cada uno:
  - Lint, typecheck y tests deben pasar.
  - Haz commit.
  - Dame un link de Vercel que pueda abrir en mi celular.
  - Dame una lista corta de qué probar y qué debería pasar.
  Luego para y espera mi OK.
- Revisa la documentación oficial actual de Mercado Pago, Supabase y Next.js antes de integrarlos.
- Simple antes que ingenioso. No agregues nada fuera de alcance sin preguntarme.
- Evita cosas que tenga que instalar o correr en mi computadora (como Docker); prefiere servicios en la nube.
- Mantén los costos en cero mientras se pueda. Si un plan gratuito no permite uso comercial o tiene un límite que me afecte, avísame antes de lanzar.
- Háblame en español. Interfaz en español de México; código en inglés.

## Stack
- Next.js (App Router), TypeScript, Tailwind y shadcn/ui.
- Supabase: Postgres, Auth con magic link, Storage para logos y RLS en todas las tablas. Configura Resend como SMTP de Supabase Auth para que los magic links lleguen.
- Mercado Pago: Checkout Pro para anticipos y Suscripciones para membresías. Usa credenciales de prueba hasta que yo diga.
- Resend para correos.
- Vercel para deploy.
- Zod para validar y Vitest para tests.

## Reglas de negocio
- MXN con formato es-MX. Zona horaria America/Mexico_City.
- Tipos de vehículo editables por negocio.
- Cada servicio tiene precio por tipo de vehículo. Se marca como "base" (servicio o paquete principal) o "extra" (se agrega a uno base). El cliente elige 1 base y 0 o más extras.
- Zonas de cobertura con recargo opcional. Si la zona del cliente no está, mostrar botón "Pregúntanos por WhatsApp".
- Agenda por franjas (ej. Mañana / Tarde) con cupo por franja, días laborales y fechas bloqueadas.
- Anticipo por negocio: porcentaje o monto fijo. El saldo se paga el día del servicio.
- El precio SIEMPRE se calcula en el servidor; nunca confíes en montos que mande el navegador.
- Al iniciar el pago, el lugar queda apartado 30 min. Si no se paga, se libera.
- Para el anticipo, solo métodos de acreditación inmediata (tarjeta y saldo de Mercado Pago). Efectivo tipo OXXO apagado por defecto.
- Estados de reserva: pending_payment → confirmed → completed | cancelled | no_show | expired.
- Folio corto por reserva (ej. JBS-1042).
- Antes de pagar, el cliente acepta la política de cancelación y el aviso de privacidad (textos editables por negocio).
- Reembolsos manuales desde Mercado Pago; el sistema solo registra el estado.
- Protección básica contra spam en el formulario (honeypot + límite de intentos por IP).

## Parte 1: cotizador + reserva (primero)
Página pública /[slug], mobile-first (casi todos llegan desde WhatsApp o Facebook en el celular):
1. El cliente elige vehículo, servicios (ve el precio al instante), zona y fecha con franja disponible. Luego captura nombre, celular de 10 dígitos, dirección, referencias y email opcional.
2. Resumen: total, anticipo y saldo.
3. Pago del anticipo con Checkout Pro.
4. El webhook de Mercado Pago confirma la reserva (verifica la firma y que sea idempotente). La página de regreso consulta el estado; no confía solo en la redirección.
5. Página de éxito con botón wa.me que abre WhatsApp al negocio con un mensaje prellenado: folio, fecha, franja, dirección, vehículo, servicios, total, anticipo pagado y saldo. Usa formato internacional (52 + 10 dígitos) y verifica que abra bien con números de México.
6. Correo al negocio por cada reserva confirmada.
7. Metadatos Open Graph por negocio para que el link se vea bien al compartirlo en WhatsApp.

Panel del negocio (login con magic link), pensado para usarse desde el celular:
- Reservas de hoy y próximas. Acciones: completar, no-show, saldo pagado, cancelar.
- Botón wa.me en cada reserva para mandarle al cliente un recordatorio prellenado.
- Reservas manuales (las que llegan por teléfono o WhatsApp), que también ocupan cupo.
- Editar:
  - Precios (vehículo × servicio).
  - Zonas, franjas y cupos.
  - Días laborales y fechas bloqueadas.
  - Anticipo y textos legales.
  - WhatsApp, nombre, logo y color.

Superadmin (solo yo):
- Crear negocios, asignar slug e invitar al dueño por email.
- Ver por negocio las reservas confirmadas por semana y los miembros activos.

## Parte 2: membresías (cuando la Parte 1 funcione)
- El negocio crea planes: nombre, servicios incluidos, lavados por mes y precio por tipo de vehículo.
- En /[slug]/membresias el cliente elige plan y vehículo y se suscribe con cobro recurrente de Mercado Pago. Email obligatorio.
- Cada cobro aprobado (avisado por webhook) recarga los créditos del periodo. Los créditos no se acumulan de un mes a otro.
- Reservar con crédito usa el mismo flujo, sin anticipo. Extras y recargos fuera del plan se cobran como saldo.
- Si un cobro falla o se cancela, la membresía se pausa y no puede usar créditos.
- Portal del miembro (magic link): créditos restantes, reservar, próximo cobro y cancelar en un clic.
- En el panel: miembros activos y pausados, créditos usados e ingreso mensual recurrente.

## Pagos por negocio
El dinero de anticipos y membresías debe llegar a la cuenta de Mercado Pago de CADA negocio, no a la mía.
- En los primeros hitos usa mis credenciales desde variables de entorno, pero deja el modelo listo para credenciales por negocio.
- En el hito multi-negocio, revisa la documentación oficial. Si la vinculación de cuentas por OAuth está disponible en México para Checkout Pro y Suscripciones, úsala. Si no, guarda el access token de cada negocio cifrado en el servidor.

## Fuera de alcance
- API de WhatsApp o bots.
- App nativa.
- Mapas o rutas.
- Empleados o nómina.
- Facturación CFDI automática.
- Inventario.
- Otros idiomas.
- El cobro de mi suscripción a los negocios (lo cobro a mano con links de pago).

## Hitos sugeridos
0. Repo, proyecto en Supabase, esquema, migraciones, RLS, datos de mi negocio y primer deploy en Vercel.
1. Página pública y cotizador sin pago, con tests de precios y disponibilidad.
2. Anticipo con Mercado Pago de prueba: webhook, apartado y expiración, página de éxito con wa.me y correo.
3. Panel del negocio.
4. Multi-negocio: superadmin, credenciales por negocio y Open Graph.
5. Membresías, con tests de créditos.

Antes de usar credenciales reales, haz una revisión de seguridad (RLS, secretos, webhooks y precios calculados en servidor) y explícame en simple qué revisaste.

## Listo cuando
- Desde mi celular puedo abrir la página de JB's Bros, cotizar y pagar un anticipo de prueba.
- Veo la reserva confirmada en mi panel y el botón abre WhatsApp con el mensaje correcto.
- Un cliente de prueba puede suscribirse a una membresía, reservar con crédito y cancelar solo.

El nombre del producto aún no está decidido; déjalo en un solo lugar para cambiarlo fácil.

## Decisiones
Respuestas del dueño y cambios de alcance aprobados, en orden.

### 2026-10-12 — Antes del Hito 0
- El negocio se llama **JB's Bros** (ya no AV Washes). Página: `/jbsbros`. Folios: `JBS-1001`, `JBS-1002`…
- **No hay dominio propio** todavía. Sin dominio, Resend solo entrega correos al dueño de la cuenta de Resend.
  Alcanza para los hitos 0 a 3; hay que comprar dominio antes del hito multi-negocio y de membresías.
- **Vercel**: plan gratis mientras probamos. Antes del primer cobro real se decide entre Vercel Pro (US$20 al mes)
  u otro servicio que permita uso comercial gratis.
- **Anticipación**: se puede reservar el mismo día si faltan al menos 2 horas para que empiece la franja.
  Máximo 30 días hacia adelante (valor por defecto, editable por negocio).
- **Superadmin**: vazquique@gmail.com (asumido, pendiente de confirmar).
- Técnicas: Next.js 16 con Cache Components; llaves nuevas de Supabase (publishable/secret); las migraciones
  se aplican solas con GitHub Actions; las pruebas de base de datos corren en Postgres en memoria (PGlite),
  sin Docker.

### 2026-10-12 — Datos de JB's Bros (Hito 0)
- WhatsApp: 33 1459 6017. Anticipo: 50%.
- Vehículos: Carro normal, Camioneta mediana, Camioneta grande.
- Servicio principal: Lavado normal ($230 / $270 / $300).
- 13 extras, todavía sin precio. Un extra sin precio no se ofrece en el cotizador.
  Pendiente: si "Full detailing" es paquete principal o extra.
- Zona: Zapopan (zona norte), sin recargo. Para otras zonas, botón de WhatsApp. Pendiente: colonias y recargos.
- Lunes a domingo de 9:00 a 18:00. Franjas: Mañana 9–13 y Tarde 13–18. Pendiente: cupo real (por ahora 2).
- El dueño quiere editar estos datos él mismo (panel del negocio, Hito 3). Pendiente: si se adelanta.

### 2026-10-12 — Respuestas del dueño y nuevo orden de hitos
- "Full detailing" incluye todos los servicios y se elige en lugar del lavado normal: es servicio principal.
- Caben 3 lavados normales por franja. Con extras caben menos; el dueño lo valora. Por ahora el cupo es 3 por franja.
  Pendiente proponer cómo considerar los extras en el cupo (al hacer el cotizador).
- Zonas: Capital Norte, Valle Imperial, Real de Valdepeñas, La Cima y Boreales, sin recargo.
- El dueño entra al panel con vazquique@gmail.com (también es el superadmin).
- Nuevo orden (el dueño lo dejó a criterio de Claude): primero la parte del panel para editar los datos del
  negocio, luego el cotizador, luego el anticipo con Mercado Pago, luego la parte del panel de reservas,
  multi-negocio y membresías.

### 2026-10-12 — Panel para editar datos (Hito 1 del nuevo orden)
- Entrada al panel sin contraseña: código de 6 dígitos por correo (también sirve el botón del correo).
  Funciona aunque el correo se abra en otro navegador. Nadie puede registrarse solo; el acceso es por invitación.
- El panel edita: servicios (principal/extra, precio por vehículo, visible), tipos de vehículo, zonas y recargos,
  franjas y cupos, días de trabajo, anticipación mínima, días hacia adelante, fechas bloqueadas, nombre, WhatsApp,
  color, logo, anticipo y textos legales.
- Borrar algo que ya tiene reservas no se permite; se oculta en su lugar.
- El logo se achica en el celular antes de subirlo (máximo 512 px).

### 2026-10-12 — Cotizador (Hito 2 del nuevo orden)
- Lugares por servicio (aprobado por el dueño): cada franja tiene lugares (cupo) y cada servicio ocupa los
  lugares que diga el panel. Lavado normal 1, Full detailing 3 (la franja completa), extras 0 por defecto.
  Una reserva ocupa la suma (mínimo 1) y solo se ofrecen franjas donde cabe.
- Mientras llega el pago con Mercado Pago, el resumen termina con "Enviar por WhatsApp para apartar"
  (mensaje con vehículo, servicios, colonia, fecha, horario, dirección, datos y montos).
- Protección contra spam: honeypot desde ahora; el límite de intentos por IP se agrega con la creación de
  reservas (siguiente hito), que es cuando se guarda algo.
- Servicios principales que "incluyen todos los extras" (Full detailing): al elegirlos se ocultan los extras y
  nunca se cobran aparte. Se marca por servicio en el panel (aprobado por el dueño).

### 2026-10-12 — Correo de acceso al panel
- El correo del panel no llegaba: el usuario del dueño nunca se creó y la página igual decía "te llegó un
  código". Ahora, si el correo no se pudo enviar, la página lo dice ("No pudimos enviar el correo…").
- Límite de correos de Supabase subido de 2 a 30 por hora (se aplica con la configuración de Auth).
- Revisión manual: el workflow `diagnose-login.yml` revisa usuario, invitación y SMTP, crea el usuario del
  dueño invitado si falta y manda un código real. `/api/health` también dice si la llave secreta funciona.

### 2026-10-12 — Anticipo con Mercado Pago (Hito 3 del nuevo orden)
- El cliente elige pagar solo el anticipo o todo de una vez (idea del dueño). Si el anticipo es 0 o ya es el
  total, solo se ofrece pagar todo.
- Al tocar "Pagar", el servidor recalcula el precio, aparta los lugares 30 minutos y abre Checkout Pro. El
  cobro de Mercado Pago vence junto con el apartado. Si el mismo celular vuelve a empezar, su apartado anterior
  se libera.
- Solo tarjeta y saldo de Mercado Pago (sin OXXO/efectivo, cajeros ni transferencias), modo binario (aprobado
  o rechazado) y en una sola exhibición (sin meses).
- Límite contra spam: honeypot y 10 pagos iniciados por IP por hora (la IP se guarda como hash, no tal cual).
- Confirman la reserva el webhook firmado (configurado en Tus integraciones, evento "Pagos") y la página de
  regreso, que le pregunta el pago a Mercado Pago. Correo al negocio una sola vez por reserva confirmada.
- Un pago aprobado que llega después de los 30 minutos igual confirma (el dinero ya entró); si el negocio
  canceló la reserva, no. Reembolsos a mano en Mercado Pago; si llega el aviso, la reserva queda como reembolsada.
- Mientras Mercado Pago no esté configurado en Vercel, el resumen sigue con "Enviar por WhatsApp para apartar".
- Credenciales de prueba (cuenta de prueba vendedora) hasta que el dueño diga. `/api/health` dice si el token
  es de una cuenta de prueba.

### 2026-10-12 — Servicios por área y dibujo del auto (pedido del dueño)
- Cada servicio tiene área (exterior o interior) y las partes del auto que trabaja: carrocería, vidrios, rines y
  llantas, faros, plásticos exteriores, asientos, pisos y alfombras, y tablero.
- Página del cliente: tarjetas con ícono y partes; extras en pestañas Exterior / Interior; un dibujo del auto
  visto desde arriba ilumina, en vivo y en el resumen, lo que se le va a hacer.
- Panel: servicios agrupados (Principales, Extras de exterior, Extras de interior) con flechas para acomodarlos y
  botones para elegir las partes, con el dibujo en miniatura. Se quitó el campo "Orden": lo nuevo va al final de
  su grupo.
- Áreas, partes y orden inicial de JB's Bros los puso Claude; el dueño puede cambiarlos.
- El pago con Mercado Pago está listo pero espera las llaves de prueba (el dueño las pondrá después).

### 2026-10-12 — Página más gráfica y explicaciones de cada servicio (pedido del dueño)
- Lavado normal incluye lavado, aspirado y limpieza rápida de paneles y tablero (lo dijo el dueño): ya se
  ilumina así en el dibujo y es su descripción.
- Cada servicio puede tener una explicación en palabras simples ("¿Qué es esto?"): qué es, antes y después, los
  pasos con dibujos y el resultado. Se elige de una lista que trae la app (14 servicios comunes de lavado y
  detallado), así sirve igual para otros negocios. Sin prometer cuánto dura cada tratamiento.
- Más decoración: encabezado con el color del negocio, burbujas y un auto; sección "¿Cómo funciona?" en 4 pasos;
  íconos en cada paso; siluetas de carro y camioneta al elegir el vehículo.
- En el panel, cada servicio tiene "Explicación para el cliente" con vista previa.

### 2026-10-13 — Antes y después propio de cada servicio (pedido del dueño)
- Lavado normal es solo lavado, aspirado y limpieza rápida, sin plásticos ni tablero (lo dijo el dueño; corrige la
  decisión anterior). En el dibujo del auto se iluminan carrocería, vidrios, rines y pisos.
- Cada servicio tiene su propio dibujo de antes y después, no una plantilla: auto con "LÁVAME" en el polvo → limpio;
  camioneta en una cochera → en exhibición con moño; frente con mosquitos y faros amarillos → blanco y con luces;
  interior con basura, mosca y mal olor → limpio con pinito; pintura vista con lupa (fierro, chapopote, savia) → lisa;
  agua que se extiende → gotas redondas; capa cerámica que rebota sol y lluvia; parabrisas borroso → nítido; rin con
  polvo de frenos → pulido; faro amarillo de noche → claro y alumbrando; parrilla gris → negra; asiento con manchas y
  lodo → limpio y aspirado; tablero con polvo y un dedazo → como nuevo; cuero agrietado → suave.
- El cliente desliza la herramienta del servicio (espuma, cepillo, spray, barra de arcilla…) para pasar de antes a
  después. Al abrir la explicación la herramienta se mueve sola una vez para enseñar que se puede deslizar.
