# Reservas a domicilio

Cotizador, reservas con anticipo y membresías para lavado de autos a domicilio.
Primer negocio: JB's Bros (Zapopan, Jalisco).

- Qué hace y en qué orden se construye: [`SPEC.md`](SPEC.md)
- Cómo se trabaja en el código: [`CLAUDE.md`](CLAUDE.md)

## Cómo se publica
- Cada cambio en la rama `main` se publica solo en Vercel.
- Los cambios de base de datos (`supabase/migrations/`) se aplican solos a Supabase con GitHub Actions.
