DROP POLICY IF EXISTS "Anyone can upload print files" ON storage.objects;

CREATE POLICY "Anyone can upload print files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'print-files');