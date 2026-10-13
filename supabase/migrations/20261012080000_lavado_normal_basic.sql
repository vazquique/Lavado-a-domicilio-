-- JB's Bros: "Lavado normal" is only washing, vacuuming and a quick clean. It doesn't touch the
-- plastics (the owner, 2026-10-12), so it no longer lights up "Tablero y plásticos interiores".
-- The description is replaced only if it's still the one set by the previous migration.
update public.services s
set car_parts = '{body,windows,wheels,floors}',
    description = case
      when s.description in ('', 'Lavado exterior, aspirado y limpieza rápida de paneles y tablero.')
        then 'Lavado, aspirado y limpieza rápida.'
      else s.description
    end
from public.businesses b
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = 'Lavado normal';
