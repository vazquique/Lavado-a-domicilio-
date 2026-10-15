-- Two notices on the booking page (the owner, 2026-10-15): prices can change when a car
-- needs extra work (dog hair, lots of bugs), and special jobs that aren't in the list, like
-- removing mold, are quoted by WhatsApp. The owner edits them in "Tu negocio"; empty hides
-- them.
alter table public.businesses
  add column price_notice text not null
    default 'Los precios pueden cambiar si el auto trae algo fuera de lo normal, como mucho pelo de perro o muchos mosquitos.'
    check (char_length(price_notice) <= 300),
  add column special_services_notice text not null
    default 'Los servicios especiales, como quitar hongos, se cotizan por WhatsApp.'
    check (char_length(special_services_notice) <= 300);

-- Everyone already reads businesses (active ones); members can now edit these two too.
grant update (price_notice, special_services_notice) on table public.businesses to authenticated;
