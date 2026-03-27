import { supabase } from '@/integrations/supabase/client';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { exportBodyToSTL } from '@/lib/stl-export';
import { captureCanvasThumbnail } from '@/lib/thumbnail-capture';

export interface ExhibitSubmission {
  visitorName: string;
  visitorEmail?: string;
  params: ParametricParams;
  objectType: ObjectType;
}

export async function submitToExhibitQueue(submission: ExhibitSubmission): Promise<{ queuePosition: number; id: string }> {
  // 1. Generate STL blob
  const stlBlob = exportBodyToSTL(submission.params, submission.objectType);
  const filename = `print_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.stl`;

  // 2. Upload STL to storage
  const { error: uploadError } = await supabase.storage
    .from('print-files')
    .upload(filename, stlBlob, { contentType: 'application/octet-stream' });

  if (uploadError) throw new Error(`STL upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage
    .from('print-files')
    .getPublicUrl(filename);

  // 3. Capture thumbnail
  let thumbnailUrl: string | null = null;
  try {
    thumbnailUrl = await captureCanvasThumbnail(200);
  } catch (e) {
    console.warn('Thumbnail capture failed:', e);
  }

  // 4. Insert queue entry
  const entryId = crypto.randomUUID();
  const { error } = await supabase
    .from('print_queue')
    .insert({
      id: entryId,
      visitor_name: submission.visitorName,
      visitor_email: submission.visitorEmail || null,
      params: submission.params as any,
      object_type: submission.objectType,
      stl_url: urlData.publicUrl,
      thumbnail_url: thumbnailUrl,
      status: 'pending',
    });

  if (error) throw new Error(`Queue submission failed: ${error.message}`);

  // 5. Get queue position (count of pending items before this one)
  const { count } = await supabase
    .from('print_queue')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'printing']);

  return { queuePosition: count || 1, id: data.id };
}
