import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { captureCanvasThumbnail } from '@/lib/thumbnail-capture';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface GalleryDesign {
  id: string;
  name: string;
  description: string | null;
  object_type: ObjectType;
  params: ParametricParams;
  thumbnail_url: string | null;
  created_at: string;
}

export const useGallery = () => {
  const [designs, setDesigns] = useState<GalleryDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDesigns = useCallback(async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gallery_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to our type (params is stored as JSONB)
      setDesigns((data || []).map(d => ({
        ...d,
        object_type: d.object_type as ObjectType,
        params: d.params as unknown as ParametricParams,
      })));
    } catch (error) {
      console.error('Error fetching gallery designs:', error);
      toast.error('Failed to load gallery designs');
    } finally {
      setLoading(false);
    }
  }, []);

  const addDesign = useCallback(async (
    name: string,
    params: ParametricParams,
    objectType: ObjectType,
    description?: string
  ) => {
    if (!supabase) {
      toast.error('Database not connected');
      return false;
    }

    setSaving(true);
    try {
      // Capture thumbnail from canvas
      let thumbnailUrl: string | null = null;
      try {
        const thumbnailData = await captureCanvasThumbnail(200);
        
        // Upload to storage
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const base64Data = thumbnailData.split(',')[1];
        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(fileName, byteArray, {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.warn('Thumbnail upload failed:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(fileName);
          thumbnailUrl = urlData.publicUrl;
        }
      } catch (thumbError) {
        console.warn('Could not capture thumbnail:', thumbError);
      }

      // Insert design into database
      const { error } = await supabase
        .from('gallery_designs')
        .insert([{
          name,
          description: description || null,
          object_type: objectType,
          params: params as unknown as Json,
          thumbnail_url: thumbnailUrl,
        }]);

      if (error) throw error;

      toast.success('Design added to gallery!');
      await fetchDesigns();
      return true;
    } catch (error) {
      console.error('Error adding design to gallery:', error);
      toast.error('Failed to add design to gallery');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchDesigns]);

  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

  return {
    designs,
    loading,
    saving,
    addDesign,
    refetch: fetchDesigns,
  };
};
