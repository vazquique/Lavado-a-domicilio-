-- A plain-language explanation of each service for customers: what it is and how it's done,
-- chosen from the list built into the app (src/lib/service-explainers.ts). Customers don't
-- know what "descontaminado mecánico" means (the owner, 2026-10-12).
alter table public.services
  add column explainer text check (explainer is null or explainer ~ '^[a-z0-9-]{1,40}$');

-- JB's Bros: "Lavado normal" also includes vacuuming and a quick clean of the door panels and
-- the dashboard (the owner, 2026-10-12). The description is only filled in if it's empty.
update public.services s
set car_parts = '{body,windows,wheels,floors,dashboard}',
    description = case
      when s.description = '' then 'Lavado exterior, aspirado y limpieza rápida de paneles y tablero.'
      else s.description
    end
from public.businesses b
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = 'Lavado normal';

update public.services s
set explainer = v.explainer
from public.businesses b,
  (values
    ('Lavado normal', 'lavado-completo'),
    ('Full detailing', 'full-detailing'),
    ('Detallado general de exteriores', 'detallado-exterior'),
    ('Descontaminado químico y mecánico de pintura', 'descontaminado-pintura'),
    ('Protección cerámica rápida con SiO2', 'ceramico-rapido'),
    ('Tratamiento cerámico', 'tratamiento-ceramico'),
    ('Descontaminado y quita gotas para vidrios', 'vidrios'),
    ('Detallado de rines y llantas', 'rines-llantas'),
    ('Restauración de faros', 'faros'),
    ('Restauración de plásticos exteriores', 'plasticos-exteriores'),
    ('Detallado general de interiores', 'detallado-interior'),
    ('Tallado de asientos y suelos', 'asientos-suelos'),
    ('Hidratación de cueros', 'cueros'),
    ('Restauración e hidratación de plásticos interiores', 'plasticos-interiores')
  ) as v (name, explainer)
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = v.name;
