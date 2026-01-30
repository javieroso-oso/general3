import JSZip from 'jszip';
import { DrawerItem, isParametricItem, isCustomItem, isPlotterItem } from '@/types/drawer';
import { 
  exportBodyToSTL, 
  exportLegsWithBaseToSTL, 
  exportCombinedToSTL,
  exportLegsOnlyToSTL 
} from './stl-export';
import { exportProfileToSTL } from './profile-to-mesh';
import { exportMoldHalfToSTL, generateMoldGeometry, generateMultiPartMoldGeometry } from './mold-generator';
import { ExportOptions, DEFAULT_EXPORT_OPTIONS } from '@/types/export-options';
import { 
  exportSocketCradleToSTL, 
  getSocketCradleParamsForShade 
} from './socket-cradle-generator';
import { generateSVG, generatePlotterGCode, generateHPGL } from './plotter/export';

export interface ExportProgress {
  current: number;
  total: number;
  currentItem?: string;
}

/**
 * Analyze drawer items to determine what components are available
 */
export function analyzeDrawerItems(items: DrawerItem[]): { 
  hasLegs: boolean; 
  hasMolds: boolean;
  hasLampShade: boolean;
  hasPlotter: boolean;
} {
  let hasLegs = false;
  let hasMolds = false;
  let hasLampShade = false;
  let hasPlotter = false;

  for (const item of items) {
    if (isParametricItem(item)) {
      if (item.params.addLegs) hasLegs = true;
      if (item.params.moldEnabled) hasMolds = true;
      if (item.params.shapeStyle === 'lamp') hasLampShade = true;
    }
    if (isPlotterItem(item)) {
      hasPlotter = true;
    }
    if (hasLegs && hasMolds && hasLampShade && hasPlotter) break; // Early exit if all found
  }

  return { hasLegs, hasMolds, hasLampShade, hasPlotter };
}

/**
 * Export multiple drawer items as STL/SVG files in a ZIP archive
 * Now supports ExportOptions for selective component export
 */
export async function exportDrawerItemsToZip(
  items: DrawerItem[],
  onProgress?: (progress: ExportProgress) => void,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<Blob> {
  const zip = new JSZip();
  const total = items.length;
  const { includeBody, includeLegs, includeMolds, includeSocketCradle, mergeMode } = options;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (isParametricItem(item)) {
      const baseName = `${item.objectType}_${i + 1}`;
      const itemHasLegs = item.params.addLegs;
      const itemHasMolds = item.params.moldEnabled;
      const itemIsLamp = item.params.shapeStyle === 'lamp';
      
      onProgress?.({
        current: i + 1,
        total,
        currentItem: baseName,
      });
      
      // Determine what to export based on options and item availability
      const shouldExportBody = includeBody;
      const shouldExportLegs = includeLegs && itemHasLegs;
      const shouldExportMolds = includeMolds && itemHasMolds;
      const shouldExportCradle = includeSocketCradle && itemIsLamp;
      
      // Handle merge modes
      if (shouldExportBody && shouldExportLegs && mergeMode !== 'separate') {
        // Export combined body + legs
        const combinedBlob = exportCombinedToSTL(item.params, item.objectType);
        zip.file(`${baseName}_combined.stl`, combinedBlob);
      } else {
        // Export separately
        if (shouldExportBody) {
          const bodyBlob = exportBodyToSTL(item.params, item.objectType);
          zip.file(`${baseName}_body.stl`, bodyBlob);
        }
        
        if (shouldExportLegs) {
          const legsBlob = exportLegsWithBaseToSTL(item.params);
          zip.file(`${baseName}_legs_base.stl`, legsBlob);
        }
      }
      
      // Handle legs-only export (when body not included)
      if (!shouldExportBody && shouldExportLegs) {
        const legsBlob = exportLegsOnlyToSTL(item.params);
        zip.file(`${baseName}_legs_base.stl`, legsBlob);
      }
      
      // Generate mold STLs if mold export is enabled
      if (shouldExportMolds) {
        const partLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
        if (item.params.moldPartCount > 2) {
          // Multi-part mold
          const moldGeometry = generateMultiPartMoldGeometry(item.params);
          for (let p = 0; p < moldGeometry.parts.length; p++) {
            const moldBlob = exportMoldHalfToSTL(moldGeometry.parts[p]);
            zip.file(`${baseName}_mold_${partLabels[p]}.stl`, moldBlob);
            moldGeometry.parts[p].dispose();
          }
        } else {
          // Two-part mold
          const moldGeometry = generateMoldGeometry(item.params);
          const moldABlob = exportMoldHalfToSTL(moldGeometry.halfA);
          const moldBBlob = exportMoldHalfToSTL(moldGeometry.halfB);
          zip.file(`${baseName}_mold_A.stl`, moldABlob);
          zip.file(`${baseName}_mold_B.stl`, moldBBlob);
          moldGeometry.halfA.dispose();
          moldGeometry.halfB.dispose();
        }
      }
      
      // Generate socket cradle STL if enabled and item is a lamp
      if (shouldExportCradle) {
        // Map BulbSocketType to SocketType (E14 falls back to E12 as closest size)
        const rawSocketType = item.params.socketType || 'E26';
        const socketType = rawSocketType === 'E14' ? 'E12' : rawSocketType;
        const cradleParams = getSocketCradleParamsForShade(item.params.baseRadius, socketType);
        const cradleBlob = await exportSocketCradleToSTL(cradleParams);
        zip.file(`${baseName}_socket_cradle.stl`, cradleBlob);
      }
    } else if (isCustomItem(item)) {
      // Custom items always export as body (no legs/molds concept)
      if (includeBody) {
        const baseName = `custom_${item.generationMode}_${i + 1}`;
        
        onProgress?.({
          current: i + 1,
          total,
          currentItem: baseName,
        });
        
        const stlBlob = exportProfileToSTL(item.profile, item.settings);
        zip.file(`${baseName}.stl`, stlBlob);
      }
    } else if (isPlotterItem(item)) {
      // Plotter items export as SVG (and optionally G-code/HPGL)
      const mode = item.plotterParams.mode;
      const projType = item.plotterParams.projection?.type || 'crossSection';
      const baseName = `plotter_${mode}_${projType}_${i + 1}`;
      
      onProgress?.({
        current: i + 1,
        total,
        currentItem: baseName,
      });
      
      // Always export SVG
      const svgContent = generateSVG(item.drawing);
      zip.file(`${baseName}.svg`, svgContent);
      
      // Also include G-code for plotter machines
      const gcodeContent = generatePlotterGCode(item.drawing, item.plotterParams.machinePreset);
      zip.file(`${baseName}.gcode`, gcodeContent);
      
      // And HPGL for legacy plotters
      const hpglContent = generateHPGL(item.drawing);
      zip.file(`${baseName}.hpgl`, hpglContent);
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
