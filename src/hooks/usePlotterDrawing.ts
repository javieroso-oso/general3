import { useMemo } from 'react';
import { PlotterParams, PlotterDrawing, PAPER_SIZES } from '@/types/plotter';
import { ParametricParams, ShapeStyle } from '@/types/parametric';
import { 
  generateFlowField, 
  generateSpiral, 
  generateConcentricCircles,
  generateLissajous,
  generateWaves 
} from '@/lib/plotter/generators';
import { generateProjection } from '@/lib/plotter/projection';
import { optimizePaths, clipToBounds } from '@/lib/plotter/path-utils';

interface UsePlotterDrawingOptions {
  params: PlotterParams;
  currentMeshParams?: ParametricParams;
  currentShapeStyle?: ShapeStyle;
}

export function usePlotterDrawing({ params, currentMeshParams, currentShapeStyle }: UsePlotterDrawingOptions): PlotterDrawing | null {
  return useMemo(() => {
    const paper = PAPER_SIZES[params.paperSize] || PAPER_SIZES.a4;
    const width = params.orientation === 'landscape' ? paper.height : paper.width;
    const height = params.orientation === 'landscape' ? paper.width : paper.height;
    const margin = params.marginMm;

    let drawing: PlotterDrawing;

    // Handle projection mode - use live mesh params if available, fallback to captured
    if (params.mode === 'projection') {
      // Prefer live mesh params, fall back to captured
      const meshParams = currentMeshParams || (params.capturedMesh?.params as unknown as ParametricParams);
      const objectType = currentShapeStyle || params.capturedMesh?.objectType || 'vase';
      
      if (!meshParams) {
        // No mesh params available - return empty drawing
        return {
          paths: [],
          width,
          height,
          units: 'mm',
        };
      }
      
      drawing = generateProjection({
        params: params.projection,
        meshParams,
        objectType,
        width,
        height,
        margin,
      });
    } else {
      // Generative mode
      switch (params.pattern) {
        case 'flowField':
          drawing = generateFlowField({
            params: params.flowField,
            width,
            height,
            margin,
          });
          break;

        case 'spiral':
          drawing = generateSpiral({
            params: params.spiral,
            width,
            height,
            margin,
          });
          break;

        case 'concentricCircles':
          drawing = generateConcentricCircles({
            params: params.spiral,
            width,
            height,
            margin,
          });
          break;

        case 'lissajous':
          drawing = generateLissajous({
            params: params.lissajous,
            width,
            height,
            margin,
          });
          break;

        case 'waveFunctions':
          drawing = generateWaves({
            params: params.wave,
            width,
            height,
            margin,
            seed: params.flowField.seed,
          });
          break;

        default:
          // Fallback to flow field
          drawing = generateFlowField({
            params: params.flowField,
            width,
            height,
            margin,
          });
      }
    }

    // Clip to bounds
    drawing = clipToBounds(drawing, margin);

    // Optimize path order if enabled
    if (params.optimizePaths) {
      drawing = {
        ...drawing,
        paths: optimizePaths(drawing.paths),
      };
    }

    return drawing;
  }, [params]);
}
