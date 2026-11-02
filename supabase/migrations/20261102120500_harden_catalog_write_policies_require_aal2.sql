-- Keep catalog write policies aligned with the test project's hardened RLS.
-- Admin identity and AAL2 are both required for every write operation.

BEGIN;

DROP POLICY IF EXISTS "Admins can insert games" ON public.games;
CREATE POLICY "Admins can insert games"
ON public.games FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can update games" ON public.games;
CREATE POLICY "Admins can update games"
ON public.games FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
)
WITH CHECK (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
CREATE POLICY "Admins can delete games"
ON public.games FOR DELETE TO authenticated
USING (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
)
WITH CHECK (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE TO authenticated
USING (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

DROP POLICY IF EXISTS "Admins can manage product costs" ON public.product_costs;
CREATE POLICY "Admins can manage product costs"
ON public.product_costs FOR ALL TO authenticated
USING (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
)
WITH CHECK (
  (SELECT public.is_admin())
  AND (SELECT auth.jwt() ->> 'aal') = 'aal2'
);

COMMIT;
