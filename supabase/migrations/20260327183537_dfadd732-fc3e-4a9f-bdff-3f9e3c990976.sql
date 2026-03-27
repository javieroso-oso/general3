
CREATE TABLE public.print_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL,
  visitor_email text,
  params jsonb NOT NULL,
  object_type text NOT NULL,
  stl_url text,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit prints"
  ON public.print_queue FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can view queue"
  ON public.print_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update queue"
  ON public.print_queue FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue;

INSERT INTO storage.buckets (id, name, public)
VALUES ('print-files', 'print-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload print files"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'print-files');

CREATE POLICY "Anyone can read print files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'print-files');

CREATE POLICY "Authenticated can delete print files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'print-files');
