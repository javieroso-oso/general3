
-- Drop the overly-permissive anon SELECT policy
DROP POLICY IF EXISTS "Anon can read own insert" ON public.print_queue;

-- Create a security definer function for queue position (no sensitive data exposed)
CREATE OR REPLACE FUNCTION public.get_queue_position()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.print_queue
  WHERE status IN ('pending', 'printing');
$$;
