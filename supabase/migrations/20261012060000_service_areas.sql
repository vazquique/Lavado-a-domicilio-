-- Where each service works on the car. The booking page groups the extras by area
-- (exterior / interior) and lights up the car parts on a drawing as the customer chooses.
-- The owner asked on 2026-10-12 to split the services into interior and exterior.

alter table public.services
  add column area text not null default 'exterior' check (area in ('exterior', 'interior')),
  add column car_parts text[] not null default '{}'
    check (car_parts <@ array['body', 'windows', 'wheels', 'lights', 'trim', 'seats', 'floors', 'dashboard']);

-- JB's Bros: area and parts of each service (the owner can change them in the panel).
update public.services s
set area = v.area, car_parts = v.parts::text[]
from public.businesses b,
  (values
    ('Lavado normal', 'exterior', '{body,windows,wheels}'),
    ('Full detailing', 'exterior', '{body,windows,wheels,lights,trim,seats,floors,dashboard}'),
    ('Detallado general de exteriores', 'exterior', '{body,windows,wheels,lights,trim}'),
    ('Descontaminado químico y mecánico de pintura', 'exterior', '{body}'),
    ('Protección cerámica rápida con SiO2', 'exterior', '{body}'),
    ('Tratamiento cerámico', 'exterior', '{body}'),
    ('Descontaminado y quita gotas para vidrios', 'exterior', '{windows}'),
    ('Detallado de rines y llantas', 'exterior', '{wheels}'),
    ('Restauración de faros', 'exterior', '{lights}'),
    ('Restauración de plásticos exteriores', 'exterior', '{trim}'),
    ('Detallado general de interiores', 'interior', '{seats,floors,dashboard}'),
    ('Tallado de asientos y suelos', 'interior', '{seats,floors}'),
    ('Hidratación de cueros', 'interior', '{seats}'),
    ('Restauración e hidratación de plásticos interiores', 'interior', '{dashboard}')
  ) as v (name, area, parts)
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = v.name;

-- Start the extras in a tidy order inside each area: whole packages first, then by part.
update public.services s
set sort_order = v.sort_order
from public.businesses b,
  (values
    ('Detallado general de exteriores', 10),
    ('Descontaminado químico y mecánico de pintura', 20),
    ('Protección cerámica rápida con SiO2', 30),
    ('Tratamiento cerámico', 40),
    ('Descontaminado y quita gotas para vidrios', 50),
    ('Detallado de rines y llantas', 60),
    ('Restauración de faros', 70),
    ('Restauración de plásticos exteriores', 80),
    ('Detallado general de interiores', 10),
    ('Tallado de asientos y suelos', 20),
    ('Hidratación de cueros', 30),
    ('Restauración e hidratación de plásticos interiores', 40)
  ) as v (name, sort_order)
where b.id = s.business_id and b.slug = 'jbsbros' and s.name = v.name;
