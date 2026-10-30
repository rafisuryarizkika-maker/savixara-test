-- Restrict direct catalog table writes to authenticated clients.
-- Administrative catalog changes must go through SECURITY DEFINER RPCs
-- that enforce both is_admin() and AAL2.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.games FROM authenticated;

GRANT SELECT
ON TABLE public.games TO authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.products FROM authenticated;

GRANT SELECT
ON TABLE public.products TO anon, authenticated;
