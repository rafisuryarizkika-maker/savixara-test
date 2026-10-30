
-- AUDIT CANDIDATE ONLY.
-- Do not execute in production.
-- Intended for verified savixara-test after review.

CREATE OR REPLACE FUNCTION public.admin_save_product_prices(
  p_product_id uuid,
  p_cost_price numeric,
  p_selling_price numeric,
  p_promo_price numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Require an active admin.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- Require MFA assurance level 2.
  IF (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'AAL2 authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- Validate all inputs before writing.  
  IF p_product_id IS NULL
   OR p_cost_price IS NULL
   OR p_selling_price IS NULL
   OR p_cost_price < 0
   OR p_selling_price < 0
   OR (p_promo_price IS NOT NULL AND p_promo_price < 0)
   OR p_cost_price::text IN ('NaN', 'Infinity', '-Infinity')
   OR p_selling_price::text IN ('NaN', 'Infinity', '-Infinity')
   OR (
     p_promo_price IS NOT NULL
     AND p_promo_price::text IN ('NaN', 'Infinity', '-Infinity')
   )
THEN
  RAISE EXCEPTION 'Invalid product price input'
    USING ERRCODE = '22023';
END IF;


  -- Lock and verify the product exists.
  PERFORM 1
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Keep the catalog price columns in sync.
  UPDATE public.products
  SET cost_price = p_cost_price,
      selling_price = p_selling_price,
      promo_price = p_promo_price,
      updated_at = pg_catalog.now()
  WHERE id = p_product_id;

  -- Keep the dedicated cost table in sync too.
  INSERT INTO public.product_costs (
    product_id,
    cost_price,
    updated_at
  )
  VALUES (
    p_product_id,
    p_cost_price,
    pg_catalog.now()
  )
  ON CONFLICT (product_id)
  DO UPDATE SET
    cost_price = EXCLUDED.cost_price,
    updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$function$;

-- The RPC is callable by authenticated clients only.
-- Authorization is checked inside the function.
REVOKE ALL ON FUNCTION public.admin_save_product_prices(
  uuid, numeric, numeric, numeric
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.admin_save_product_prices(
  uuid, numeric, numeric, numeric
) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_save_product_prices(
  uuid, numeric, numeric, numeric
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_save_product_prices(
  uuid, numeric, numeric, numeric
) TO service_role;
