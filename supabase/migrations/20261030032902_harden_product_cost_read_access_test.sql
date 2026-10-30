-- Keep cost_price private from public and authenticated clients.
REVOKE SELECT ON TABLE public.products FROM anon, authenticated;
GRANT SELECT (
  id,
  game_id,
  name,
  slug,
  category,
  provider,
  provider_product_code,
  selling_price,
  promo_price,
  description,
  status,
  sort_order,
  created_at,
  updated_at,
  category_id
) ON TABLE public.products TO anon, authenticated;

-- Direct access to the private cost table is not permitted.
REVOKE ALL PRIVILEGES ON TABLE public.product_costs FROM anon, authenticated;
