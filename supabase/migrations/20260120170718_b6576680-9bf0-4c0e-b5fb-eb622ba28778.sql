-- Create a table for gallery designs (public, anyone can view)
CREATE TABLE public.gallery_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  object_type TEXT NOT NULL,
  params JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gallery_designs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view gallery designs (public gallery)
CREATE POLICY "Anyone can view gallery designs"
ON public.gallery_designs
FOR SELECT
USING (true);

-- Allow anyone to insert new designs (public submissions)
CREATE POLICY "Anyone can add designs to gallery"
ON public.gallery_designs
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true);

-- Allow public read access to thumbnails
CREATE POLICY "Thumbnails are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'thumbnails');

-- Allow anyone to upload thumbnails
CREATE POLICY "Anyone can upload thumbnails"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');