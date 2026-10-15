-- The owner asked to remove the character limit on the page's texts (2026-10-15). The
-- notices lose their 300-character check, like the service descriptions and the policies,
-- which never had one; the panel only refuses absurdly long pastes.
alter table public.businesses
  drop constraint businesses_price_notice_check,
  drop constraint businesses_special_services_notice_check;
