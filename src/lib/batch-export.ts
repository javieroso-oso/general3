import JSZip from 'jszip';
import { DrawerItem, isParametricItem, isCustomItem } from '@/types/drawer';
import { exportBodyToSTL, exportLegsWithBaseToSTL } from './stl-export';
import { exportProfileToSTL } from './profile-to-mesh';

export interface ExportProgress {
  current: number;
  total: number;
  currentItem?: string;
}

/**
 * Export multiple drawer items as STL files in a ZIP archive
 */
export async function exportDrawerItemsToZip(
  items: DrawerItem[],
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = items.length;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (isParametricItem(item)) {
      const baseName = `${item.objectType}_${i + 1}`;
      
      onProgress?.({
        current: i + 1,
        total,
        currentItem: baseName,
      });
      
      // Generate body STL
      const bodyBlob = exportBodyToSTL(item.params, item.objectType);
      zip.file(`${baseName}_body.stl`, bodyBlob);
      
      // Generate legs/base STL if applicable
      if (item.params.addLegs) {
        const legsBlob = exportLegsWithBaseToSTL(item.params);
        zip.file(`${baseName}_legs_base.stl`, legsBlob);
      }
    } else if (isCustomItem(item)) {
      const baseName = `custom_${item.generationMode}_${i + 1}`;
      
      onProgress?.({
        current: i + 1,
        total,
        currentItem: baseName,
      });
      
      // Generate custom profile STL
      const stlBlob = exportProfileToSTL(item.profile, item.settings);
      zip.file(`${baseName}.stl`, stlBlob);
    }
    
    // Small delay to prevent UI freeze on large exports
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
