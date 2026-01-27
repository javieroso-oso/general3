/**
 * 3D-to-2D Projection for Plotter Output
 * 
 * Converts parametric 3D shapes into 2D plotter paths using:
 * - Cross-section slices (horizontal cuts)
 * - Silhouette extraction (outer boundary from view angle)
 * - Contour stacks (offset slices for layered effect)
 * - Line field (parallel/radial lines distorted by shape)
 */

import { PlotterDrawing, PlotterPath, ProjectionParams, PAPER_SIZES, LineFieldGeometry } from '@/types/plotter';
import { ParametricParams, ObjectType3D } from '@/types/parametric';
import { getBodyRadius, getMaxBodyRadius } from '@/lib/body-profile-generator';
import { noise2D, seedNoise } from './noise';

interface ProjectionOptions {
  params: ProjectionParams;
  meshParams: ParametricParams;
  objectType: ObjectType3D;
  width: number;
  height: number;
  margin: number;
}

// Ramer-Douglas-Peucker path simplification algorithm
function simplifyPath(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  
  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // If max distance exceeds tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  
  return [first, last];
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;
  
  if (lineLenSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const area = Math.abs(
    (lineEnd.y - lineStart.y) * point.x -
    (lineEnd.x - lineStart.x) * point.y +
    lineEnd.x * lineStart.y -
    lineEnd.y * lineStart.x
  );
  
  return area / Math.sqrt(lineLenSq);
}

/**
 * Generate cross-section slices at multiple heights.
 * Each slice samples the body radius at many angles to create a closed contour.
 */
export function generateCrossSectionSlices(options: ProjectionOptions): PlotterDrawing {
  const { params, meshParams, objectType, width, height, margin } = options;
  const { sliceCount, viewAngle, scale, lineDetail, centerOffset, simplifyTolerance } = params;
  
  const paths: PlotterPath[] = [];
  const objectHeight = meshParams.height;
  
  // Find max radius for scaling
  const maxRadius = getMaxBodyRadius(meshParams, { objectType, scale: 1 });
  
  // Calculate the bounding box of projected slices
  const projectedPoints: { x: number; y: number }[] = [];
  
  // Sample all slices first to find bounds
  const sliceData: { t: number; points: { x: number; y: number }[] }[] = [];
  const angleSegments = lineDetail; // Use lineDetail setting
  
  for (let i = 0; i <= sliceCount; i++) {
    const t = i / sliceCount;
    const slicePoints: { x: number; y: number }[] = [];
    
    for (let j = 0; j <= angleSegments; j++) {
      const theta = (j / angleSegments) * Math.PI * 2;
      const radius = getBodyRadius(meshParams, t, theta, { 
        objectType, 
        scale: 1,
        includeTwist: true 
      });
      
      // Project 3D point to 2D based on view angle
      const point3D = {
        x: Math.cos(theta) * radius,
        y: t * objectHeight,
        z: Math.sin(theta) * radius,
      };
      
      // Apply rotation based on view angle
      const rotatedPoint = rotatePoint3D(point3D, viewAngle.x, viewAngle.y);
      
      // Project to 2D (orthographic)
      const point2D = {
        x: rotatedPoint.x,
        y: rotatedPoint.z, // Use Z as vertical in 2D for cross-section view
      };
      
      slicePoints.push(point2D);
      projectedPoints.push(point2D);
    }
    
    sliceData.push({ t, points: slicePoints });
  }
  
  // Calculate bounds
  const bounds = getBounds(projectedPoints);
  
  // Calculate scale to fit within paper
  const paperWidth = width - margin * 2;
  const paperHeight = height - margin * 2;
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  const fitScale = Math.min(
    paperWidth / boundsWidth,
    paperHeight / boundsHeight
  ) * scale * 0.9; // 90% to leave some breathing room
  
  // Calculate offset to center on paper with user offset
  const offsetX = width / 2 - (bounds.minX + boundsWidth / 2) * fitScale + centerOffset.x;
  const offsetY = height / 2 - (bounds.minY + boundsHeight / 2) * fitScale + centerOffset.y;
  
  // Create paths for each slice
  for (const slice of sliceData) {
    let transformedPoints = slice.points.map(p => ({
      x: p.x * fitScale + offsetX,
      y: p.y * fitScale + offsetY,
    }));
    
    // Apply path simplification if tolerance > 0
    if (simplifyTolerance > 0) {
      transformedPoints = simplifyPath(transformedPoints, simplifyTolerance);
    }
    
    // Close the path by connecting back to start
    if (transformedPoints.length > 2) {
      transformedPoints.push({ ...transformedPoints[0] });
    }
    
    paths.push({
      points: transformedPoints,
      penDown: true,
      layer: Math.floor(slice.t * sliceCount),
      color: `hsl(${slice.t * 240}, 70%, 50%)`, // Color gradient from blue to red
    });
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

/**
 * Generate a silhouette outline from a specific view angle.
 * Traces the outer boundary of the object.
 */
export function generateSilhouette(options: ProjectionOptions): PlotterDrawing {
  const { params, meshParams, objectType, width, height, margin } = options;
  const { viewAngle, scale, lineDetail, centerOffset, simplifyTolerance } = params;
  
  const paths: PlotterPath[] = [];
  const objectHeight = meshParams.height;
  const heightSegments = lineDetail;
  const angleSegments = lineDetail * 2;
  
  // Sample all surface points and project to 2D
  const allPoints: { x: number; y: number; z3d: number }[] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    
    for (let j = 0; j < angleSegments; j++) {
      const theta = (j / angleSegments) * Math.PI * 2;
      const radius = getBodyRadius(meshParams, t, theta, { 
        objectType, 
        scale: 1,
        includeTwist: true 
      });
      
      const point3D = {
        x: Math.cos(theta) * radius,
        y: t * objectHeight,
        z: Math.sin(theta) * radius,
      };
      
      const rotatedPoint = rotatePoint3D(point3D, viewAngle.x, viewAngle.y);
      
      allPoints.push({
        x: rotatedPoint.x,
        y: rotatedPoint.y,
        z3d: rotatedPoint.z, // Keep Z for depth sorting
      });
    }
  }
  
  // Find the outline by tracing the left and right edges at each height
  const leftEdge: { x: number; y: number }[] = [];
  const rightEdge: { x: number; y: number }[] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const startIdx = i * angleSegments;
    let minX = Infinity;
    let maxX = -Infinity;
    let minXY = 0;
    let maxXY = 0;
    
    for (let j = 0; j < angleSegments; j++) {
      const point = allPoints[startIdx + j];
      if (point.x < minX) {
        minX = point.x;
        minXY = point.y;
      }
      if (point.x > maxX) {
        maxX = point.x;
        maxXY = point.y;
      }
    }
    
    leftEdge.push({ x: minX, y: minXY });
    rightEdge.push({ x: maxX, y: maxXY });
  }
  
  // Combine into single outline path
  const outlinePoints = [
    ...leftEdge,
    ...rightEdge.reverse(),
  ];
  
  // Calculate bounds and scale
  const bounds = getBounds(outlinePoints);
  const paperWidth = width - margin * 2;
  const paperHeight = height - margin * 2;
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  const fitScale = Math.min(
    paperWidth / boundsWidth,
    paperHeight / boundsHeight
  ) * scale * 0.9;
  
  const offsetX = width / 2 - (bounds.minX + boundsWidth / 2) * fitScale + centerOffset.x;
  const offsetY = height / 2 - (bounds.minY + boundsHeight / 2) * fitScale + centerOffset.y;
  
  let transformedPoints = outlinePoints.map(p => ({
    x: p.x * fitScale + offsetX,
    y: p.y * fitScale + offsetY,
  }));
  
  // Apply simplification if tolerance > 0
  if (simplifyTolerance > 0) {
    transformedPoints = simplifyPath(transformedPoints, simplifyTolerance);
  }
  
  // Close the path
  transformedPoints.push({ ...transformedPoints[0] });
  
  paths.push({
    points: transformedPoints,
    penDown: true,
    layer: 0,
  });
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

/**
 * Generate contour stack with visual offset for 3D layered effect.
 * Similar to cross-sections but with Y offset for stacking visual.
 */
export function generateContourStack(options: ProjectionOptions): PlotterDrawing {
  const { params, meshParams, objectType, width, height, margin } = options;
  const { sliceCount, sliceSpacing, viewAngle, scale, showHiddenLines, lineDetail, perspective, centerOffset, simplifyTolerance } = params;
  
  const paths: PlotterPath[] = [];
  const objectHeight = meshParams.height;
  const angleSegments = lineDetail;
  
  // Calculate max dimensions for scaling
  const maxRadius = getMaxBodyRadius(meshParams, { objectType, scale: 1 });
  
  // Total visual height = object slices + spacing offsets
  const totalStackHeight = objectHeight + (sliceCount * sliceSpacing);
  const totalWidth = maxRadius * 2;
  
  // Calculate scale to fit
  const paperWidth = width - margin * 2;
  const paperHeight = height - margin * 2;
  
  const fitScale = Math.min(
    paperWidth / totalWidth,
    paperHeight / totalStackHeight
  ) * scale * 0.85;
  
  // Center offset with user adjustment
  const centerX = width / 2 + centerOffset.x;
  const startY = margin + (paperHeight - totalStackHeight * fitScale) / 2 + centerOffset.y;
  
  // Generate slices from bottom to top
  for (let i = 0; i <= sliceCount; i++) {
    const t = i / sliceCount;
    let slicePoints: { x: number; y: number }[] = [];
    
    // Visual Y position includes stacking offset
    const visualY = startY + (t * objectHeight + i * sliceSpacing) * fitScale;
    
    for (let j = 0; j <= angleSegments; j++) {
      const theta = (j / angleSegments) * Math.PI * 2;
      const radius = getBodyRadius(meshParams, t, theta, { 
        objectType, 
        scale: 1,
        includeTwist: true 
      });
      
      // Simple top-down view: X = cos(theta) * r, keep Y as the visual stacking position
      const point3D = {
        x: Math.cos(theta) * radius,
        y: 0, // We handle Y separately for stacking
        z: Math.sin(theta) * radius,
      };
      
      // Apply view rotation
      const rotatedPoint = rotatePoint3D(point3D, viewAngle.x, viewAngle.y);
      
      slicePoints.push({
        x: centerX + rotatedPoint.x * fitScale,
        y: visualY + rotatedPoint.z * fitScale * perspective, // Use perspective setting
      });
    }
    
    // Apply simplification if tolerance > 0
    if (simplifyTolerance > 0) {
      slicePoints = simplifyPath(slicePoints, simplifyTolerance);
    }
    
    // Close the path
    slicePoints.push({ ...slicePoints[0] });
    
    // Determine visibility (simple: show all, or hide back half based on showHiddenLines)
    const layerIndex = sliceCount - i; // Reverse layer order for proper drawing
    
    paths.push({
      points: slicePoints,
      penDown: true,
      layer: layerIndex,
      color: showHiddenLines ? undefined : `rgba(0,0,0,${0.3 + t * 0.7})`,
    });
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

/**
 * Generate line field with shape distortion.
 * Enhanced with: multi-angle overlay, organic wobble, variable density,
 * line breaks, wave modulation, shape fill, and radial mode.
 */
export function generateLineField(options: ProjectionOptions): PlotterDrawing {
  const { params, meshParams, objectType, width, height, margin } = options;
  const { 
    viewAngle, 
    scale, 
    lineFieldCount,
    lineFieldAngle,
    lineFieldStrength,
    lineFieldFalloff,
    lineFieldMode,
    lineFieldExtend,
    simplifyTolerance,
    // Enhanced settings
    lineFieldGeometry = 'parallel',
    lineFieldWobble = 0,
    lineFieldWobbleScale = 0.03,
    lineFieldDensityVar = false,
    lineFieldBreakInside = false,
    lineFieldWaveAmp = 0,
    lineFieldWaveFreq = 3,
    lineFieldOverlayCount = 1,
    lineFieldOverlayOffset = 45,
    lineFieldFillInside = false,
    lineFieldFillDensity = 2,
  } = params;
  
  // Seed noise for consistent wobble
  seedNoise(42);
  
  const paths: PlotterPath[] = [];
  const objectHeight = meshParams.height;
  const heightSegments = 64;
  const angleSegments = 128;
  
  // First, generate the silhouette boundary points
  const allPoints: { x: number; y: number; z3d: number }[] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    
    for (let j = 0; j < angleSegments; j++) {
      const theta = (j / angleSegments) * Math.PI * 2;
      const radius = getBodyRadius(meshParams, t, theta, { 
        objectType, 
        scale: 1,
        includeTwist: true 
      });
      
      const point3D = {
        x: Math.cos(theta) * radius,
        y: t * objectHeight,
        z: Math.sin(theta) * radius,
      };
      
      const rotatedPoint = rotatePoint3D(point3D, viewAngle.x, viewAngle.y);
      
      allPoints.push({
        x: rotatedPoint.x,
        y: rotatedPoint.y,
        z3d: rotatedPoint.z,
      });
    }
  }
  
  // Find the outline by tracing the left and right edges at each height
  const leftEdge: { x: number; y: number }[] = [];
  const rightEdge: { x: number; y: number }[] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const startIdx = i * angleSegments;
    let minX = Infinity;
    let maxX = -Infinity;
    let minXY = 0;
    let maxXY = 0;
    
    for (let j = 0; j < angleSegments; j++) {
      const point = allPoints[startIdx + j];
      if (point.x < minX) {
        minX = point.x;
        minXY = point.y;
      }
      if (point.x > maxX) {
        maxX = point.x;
        maxXY = point.y;
      }
    }
    
    leftEdge.push({ x: minX, y: minXY });
    rightEdge.push({ x: maxX, y: maxXY });
  }
  
  // Combine into boundary points
  const boundaryPoints = [
    ...leftEdge,
    ...rightEdge.reverse(),
  ];
  
  // Calculate bounds and scale
  const bounds = getBounds(boundaryPoints);
  const paperWidth = width - margin * 2;
  const paperHeight = height - margin * 2;
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  const fitScale = Math.min(
    paperWidth / boundsWidth,
    paperHeight / boundsHeight
  ) * scale * 0.7; // 70% to leave room for distortion
  
  const offsetX = width / 2 - (bounds.minX + boundsWidth / 2) * fitScale;
  const offsetY = height / 2 - (bounds.minY + boundsHeight / 2) * fitScale;
  
  // Transform boundary to paper coordinates
  const transformedBoundary = boundaryPoints.map(p => ({
    x: p.x * fitScale + offsetX,
    y: p.y * fitScale + offsetY,
  }));
  
  // Calculate the center of the shape
  const shapeCenter = {
    x: transformedBoundary.reduce((sum, p) => sum + p.x, 0) / transformedBoundary.length,
    y: transformedBoundary.reduce((sum, p) => sum + p.y, 0) / transformedBoundary.length,
  };
  
  // Calculate approximate shape radius
  const shapeRadius = Math.max(
    ...transformedBoundary.map(p => 
      Math.sqrt((p.x - shapeCenter.x) ** 2 + (p.y - shapeCenter.y) ** 2)
    )
  );
  
  // Generate lines for each overlay layer
  for (let layer = 0; layer < lineFieldOverlayCount; layer++) {
    const layerAngle = lineFieldAngle + layer * lineFieldOverlayOffset;
    const angleRad = (layerAngle * Math.PI) / 180;
    
    if (lineFieldGeometry === 'radial') {
      // Radial mode: lines emanate from shape center
      generateRadialLines({
        paths,
        shapeCenter,
        shapeRadius,
        transformedBoundary,
        lineFieldCount,
        lineFieldStrength,
        lineFieldFalloff,
        lineFieldMode,
        lineFieldExtend,
        lineFieldWobble,
        lineFieldWobbleScale,
        lineFieldWaveAmp,
        lineFieldWaveFreq,
        lineFieldBreakInside,
        simplifyTolerance,
        width,
        height,
        margin,
        layer,
      });
    } else {
      // Parallel mode
      generateParallelLines({
        paths,
        angleRad,
        shapeCenter,
        shapeRadius,
        transformedBoundary,
        lineFieldCount,
        lineFieldStrength,
        lineFieldFalloff,
        lineFieldMode,
        lineFieldExtend,
        lineFieldWobble,
        lineFieldWobbleScale,
        lineFieldDensityVar,
        lineFieldWaveAmp,
        lineFieldWaveFreq,
        lineFieldBreakInside,
        simplifyTolerance,
        width,
        height,
        margin,
        layer,
      });
    }
  }
  
  // Add shape fill pattern if enabled
  if (lineFieldFillInside) {
    generateShapeFill({
      paths,
      transformedBoundary,
      shapeCenter,
      lineFieldFillDensity,
      lineFieldAngle,
      simplifyTolerance,
      margin,
      width,
      height,
    });
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Helper: Generate parallel lines with distortion
function generateParallelLines(opts: {
  paths: PlotterPath[];
  angleRad: number;
  shapeCenter: { x: number; y: number };
  shapeRadius: number;
  transformedBoundary: { x: number; y: number }[];
  lineFieldCount: number;
  lineFieldStrength: number;
  lineFieldFalloff: number;
  lineFieldMode: string;
  lineFieldExtend: boolean;
  lineFieldWobble: number;
  lineFieldWobbleScale: number;
  lineFieldDensityVar: boolean;
  lineFieldWaveAmp: number;
  lineFieldWaveFreq: number;
  lineFieldBreakInside: boolean;
  simplifyTolerance: number;
  width: number;
  height: number;
  margin: number;
  layer: number;
}) {
  const {
    paths,
    angleRad,
    shapeCenter,
    shapeRadius,
    transformedBoundary,
    lineFieldCount,
    lineFieldStrength,
    lineFieldFalloff,
    lineFieldMode,
    lineFieldExtend,
    lineFieldWobble,
    lineFieldWobbleScale,
    lineFieldDensityVar,
    lineFieldWaveAmp,
    lineFieldWaveFreq,
    lineFieldBreakInside,
    simplifyTolerance,
    width,
    height,
    margin,
    layer,
  } = opts;
  
  const lineDir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
  const perpDir = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };
  
  // Calculate line spacing
  const baseSpacing = (Math.max(width, height)) / (lineFieldCount - 1);
  
  // Extend beyond page for cleaner edges
  const extension = lineFieldExtend ? baseSpacing * 2 : 0;
  const startOffset = -Math.max(width, height) - extension;
  const endOffset = Math.max(width, height) * 2 + extension;
  
  // Generate each line
  for (let i = 0; i < lineFieldCount; i++) {
    // Variable density: add extra lines near shape
    const densityLines = lineFieldDensityVar ? getDensityExtraLines(i, lineFieldCount, shapeCenter, shapeRadius, baseSpacing, perpDir, width, height) : [0];
    
    for (const densityOffset of densityLines) {
      const perpOffset = (i - (lineFieldCount - 1) / 2) * baseSpacing + densityOffset;
      const lineStart = {
        x: width / 2 + perpDir.x * perpOffset + lineDir.x * startOffset,
        y: height / 2 + perpDir.y * perpOffset + lineDir.y * startOffset,
      };
      
      const lineSegments: { x: number; y: number }[][] = [[]];
      let currentSegment = 0;
      const steps = 300; // Number of sample points per line
      
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        let baseX = lineStart.x + lineDir.x * (endOffset - startOffset) * t;
        let baseY = lineStart.y + lineDir.y * (endOffset - startOffset) * t;
        
        // Add wave modulation
        if (lineFieldWaveAmp > 0) {
          const wavePhase = t * Math.PI * 2 * lineFieldWaveFreq + i * 0.3;
          baseX += perpDir.x * Math.sin(wavePhase) * lineFieldWaveAmp;
          baseY += perpDir.y * Math.sin(wavePhase) * lineFieldWaveAmp;
        }
        
        // Add organic wobble
        if (lineFieldWobble > 0) {
          const noiseVal = noise2D(baseX * lineFieldWobbleScale, baseY * lineFieldWobbleScale);
          baseX += perpDir.x * noiseVal * lineFieldWobble * 15;
          baseY += perpDir.y * noiseVal * lineFieldWobble * 15;
        }
        
        // Find nearest boundary point and distance
        let minDist = Infinity;
        let nearestIdx = 0;
        
        for (let bi = 0; bi < transformedBoundary.length; bi++) {
          const bp = transformedBoundary[bi];
          const dist = Math.sqrt((baseX - bp.x) ** 2 + (baseY - bp.y) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = bi;
          }
        }
        
        // Check if point is inside the shape
        const isInside = isPointInsidePolygon({ x: baseX, y: baseY }, transformedBoundary);
        
        // Handle line breaks inside shape
        if (lineFieldBreakInside && isInside) {
          // Start a new segment
          if (lineSegments[currentSegment].length > 0) {
            currentSegment++;
            lineSegments[currentSegment] = [];
          }
          continue;
        }
        
        // Calculate distortion based on mode
        let distortedX = baseX;
        let distortedY = baseY;
        
        const normalizedDist = minDist / (shapeRadius * lineFieldFalloff);
        const distortionFactor = Math.exp(-normalizedDist * normalizedDist) * lineFieldStrength;
        
        if (lineFieldMode === 'around') {
          // Lines flow around the shape - push points away from center
          if (minDist < shapeRadius * lineFieldFalloff * 2) {
            const pushDir = {
              x: baseX - shapeCenter.x,
              y: baseY - shapeCenter.y,
            };
            const pushLen = Math.sqrt(pushDir.x ** 2 + pushDir.y ** 2) || 1;
            
            const pushAmount = distortionFactor * shapeRadius * 0.5;
            if (isInside) {
              distortedX += (pushDir.x / pushLen) * pushAmount * 2;
              distortedY += (pushDir.y / pushLen) * pushAmount * 2;
            } else {
              distortedX += (pushDir.x / pushLen) * pushAmount;
              distortedY += (pushDir.y / pushLen) * pushAmount;
            }
          }
        } else if (lineFieldMode === 'through') {
          // Lines pass through but compress/distort - lens effect
          if (minDist < shapeRadius * lineFieldFalloff * 2) {
            const toCenter = {
              x: shapeCenter.x - baseX,
              y: shapeCenter.y - baseY,
            };
            const toCenterLen = Math.sqrt(toCenter.x ** 2 + toCenter.y ** 2) || 1;
            
            const compression = distortionFactor * shapeRadius * 0.3;
            distortedX += (toCenter.x / toCenterLen) * compression;
            distortedY += (toCenter.y / toCenterLen) * compression;
          }
        } else if (lineFieldMode === 'outline') {
          // Lines trace the edge when they hit the boundary
          if (isInside) {
            const nearest = transformedBoundary[nearestIdx];
            const blendFactor = Math.min(1, distortionFactor * 2);
            distortedX = baseX + (nearest.x - baseX) * blendFactor;
            distortedY = baseY + (nearest.y - baseY) * blendFactor;
          } else if (minDist < shapeRadius * 0.3) {
            const nearest = transformedBoundary[nearestIdx];
            const pullFactor = distortionFactor * 0.3;
            distortedX = baseX + (nearest.x - baseX) * pullFactor;
            distortedY = baseY + (nearest.y - baseY) * pullFactor;
          }
        }
        
        lineSegments[currentSegment].push({ x: distortedX, y: distortedY });
      }
      
      // Process each segment
      for (const segment of lineSegments) {
        if (segment.length < 2) continue;
        
        // Apply simplification if needed
        let finalPoints = segment;
        if (simplifyTolerance > 0) {
          finalPoints = simplifyPath(segment, simplifyTolerance);
        }
        
        // Clip to page bounds
        const clippedPoints = finalPoints.filter(p => 
          p.x >= margin && p.x <= width - margin &&
          p.y >= margin && p.y <= height - margin
        );
        
        if (clippedPoints.length >= 2) {
          paths.push({
            points: clippedPoints,
            penDown: true,
            layer,
          });
        }
      }
    }
  }
}

// Helper: Generate radial lines emanating from center
function generateRadialLines(opts: {
  paths: PlotterPath[];
  shapeCenter: { x: number; y: number };
  shapeRadius: number;
  transformedBoundary: { x: number; y: number }[];
  lineFieldCount: number;
  lineFieldStrength: number;
  lineFieldFalloff: number;
  lineFieldMode: string;
  lineFieldExtend: boolean;
  lineFieldWobble: number;
  lineFieldWobbleScale: number;
  lineFieldWaveAmp: number;
  lineFieldWaveFreq: number;
  lineFieldBreakInside: boolean;
  simplifyTolerance: number;
  width: number;
  height: number;
  margin: number;
  layer: number;
}) {
  const {
    paths,
    shapeCenter,
    shapeRadius,
    transformedBoundary,
    lineFieldCount,
    lineFieldStrength,
    lineFieldFalloff,
    lineFieldMode,
    lineFieldExtend,
    lineFieldWobble,
    lineFieldWobbleScale,
    lineFieldWaveAmp,
    lineFieldWaveFreq,
    lineFieldBreakInside,
    simplifyTolerance,
    width,
    height,
    margin,
    layer,
  } = opts;
  
  const maxExtent = lineFieldExtend 
    ? Math.sqrt(width * width + height * height) 
    : Math.max(width, height) / 2;
  
  for (let i = 0; i < lineFieldCount; i++) {
    const angle = (i / lineFieldCount) * Math.PI * 2;
    const lineDir = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpDir = { x: -Math.sin(angle), y: Math.cos(angle) };
    
    const lineSegments: { x: number; y: number }[][] = [[]];
    let currentSegment = 0;
    const steps = 200;
    
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const radius = t * maxExtent;
      
      let baseX = shapeCenter.x + lineDir.x * radius;
      let baseY = shapeCenter.y + lineDir.y * radius;
      
      // Add wave modulation
      if (lineFieldWaveAmp > 0) {
        const wavePhase = t * Math.PI * 2 * lineFieldWaveFreq;
        baseX += perpDir.x * Math.sin(wavePhase) * lineFieldWaveAmp;
        baseY += perpDir.y * Math.sin(wavePhase) * lineFieldWaveAmp;
      }
      
      // Add organic wobble
      if (lineFieldWobble > 0) {
        const noiseVal = noise2D(baseX * lineFieldWobbleScale, baseY * lineFieldWobbleScale);
        baseX += perpDir.x * noiseVal * lineFieldWobble * 15;
        baseY += perpDir.y * noiseVal * lineFieldWobble * 15;
      }
      
      // Find nearest boundary point
      let minDist = Infinity;
      let nearestIdx = 0;
      
      for (let bi = 0; bi < transformedBoundary.length; bi++) {
        const bp = transformedBoundary[bi];
        const dist = Math.sqrt((baseX - bp.x) ** 2 + (baseY - bp.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = bi;
        }
      }
      
      const isInside = isPointInsidePolygon({ x: baseX, y: baseY }, transformedBoundary);
      
      // Handle line breaks
      if (lineFieldBreakInside && isInside) {
        if (lineSegments[currentSegment].length > 0) {
          currentSegment++;
          lineSegments[currentSegment] = [];
        }
        continue;
      }
      
      // Calculate distortion
      let distortedX = baseX;
      let distortedY = baseY;
      
      const normalizedDist = minDist / (shapeRadius * lineFieldFalloff);
      const distortionFactor = Math.exp(-normalizedDist * normalizedDist) * lineFieldStrength;
      
      if (lineFieldMode === 'around' && minDist < shapeRadius * lineFieldFalloff * 2) {
        // Push tangent to shape
        const tangentDir = { x: perpDir.x, y: perpDir.y };
        const pushAmount = distortionFactor * shapeRadius * 0.3;
        distortedX += tangentDir.x * pushAmount * (isInside ? 2 : 1);
        distortedY += tangentDir.y * pushAmount * (isInside ? 2 : 1);
      } else if (lineFieldMode === 'through' && minDist < shapeRadius * lineFieldFalloff * 2) {
        // Subtle radial compression
        const compression = distortionFactor * shapeRadius * 0.2;
        distortedX = shapeCenter.x + lineDir.x * (radius - compression);
        distortedY = shapeCenter.y + lineDir.y * (radius - compression);
      } else if (lineFieldMode === 'outline' && isInside) {
        const nearest = transformedBoundary[nearestIdx];
        const blendFactor = Math.min(1, distortionFactor * 2);
        distortedX = baseX + (nearest.x - baseX) * blendFactor;
        distortedY = baseY + (nearest.y - baseY) * blendFactor;
      }
      
      lineSegments[currentSegment].push({ x: distortedX, y: distortedY });
    }
    
    // Process segments
    for (const segment of lineSegments) {
      if (segment.length < 2) continue;
      
      let finalPoints = segment;
      if (simplifyTolerance > 0) {
        finalPoints = simplifyPath(segment, simplifyTolerance);
      }
      
      const clippedPoints = finalPoints.filter(p => 
        p.x >= margin && p.x <= width - margin &&
        p.y >= margin && p.y <= height - margin
      );
      
      if (clippedPoints.length >= 2) {
        paths.push({
          points: clippedPoints,
          penDown: true,
          layer,
        });
      }
    }
  }
}

// Helper: Generate fill pattern inside shape
function generateShapeFill(opts: {
  paths: PlotterPath[];
  transformedBoundary: { x: number; y: number }[];
  shapeCenter: { x: number; y: number };
  lineFieldFillDensity: number;
  lineFieldAngle: number;
  simplifyTolerance: number;
  margin: number;
  width: number;
  height: number;
}) {
  const {
    paths,
    transformedBoundary,
    shapeCenter,
    lineFieldFillDensity,
    lineFieldAngle,
    simplifyTolerance,
    margin,
    width,
    height,
  } = opts;
  
  const bounds = getBounds(transformedBoundary);
  const fillAngle = (lineFieldAngle + 90) * Math.PI / 180; // Perpendicular to main lines
  const lineDir = { x: Math.cos(fillAngle), y: Math.sin(fillAngle) };
  const perpDir = { x: -Math.sin(fillAngle), y: Math.cos(fillAngle) };
  
  const fillSpacing = 3 / lineFieldFillDensity; // mm between fill lines
  const fillWidth = Math.sqrt(
    (bounds.maxX - bounds.minX) ** 2 + (bounds.maxY - bounds.minY) ** 2
  );
  const fillCount = Math.ceil(fillWidth / fillSpacing);
  
  for (let i = 0; i < fillCount; i++) {
    const perpOffset = (i - fillCount / 2) * fillSpacing;
    const lineCenter = {
      x: shapeCenter.x + perpDir.x * perpOffset,
      y: shapeCenter.y + perpDir.y * perpOffset,
    };
    
    // Trace line and collect points inside shape
    const insidePoints: { x: number; y: number }[] = [];
    const steps = 100;
    const lineExtent = fillWidth;
    
    for (let step = 0; step <= steps; step++) {
      const t = (step / steps - 0.5) * 2; // -1 to 1
      const x = lineCenter.x + lineDir.x * t * lineExtent;
      const y = lineCenter.y + lineDir.y * t * lineExtent;
      
      if (isPointInsidePolygon({ x, y }, transformedBoundary)) {
        insidePoints.push({ x, y });
      }
    }
    
    if (insidePoints.length >= 2) {
      let finalPoints = insidePoints;
      if (simplifyTolerance > 0) {
        finalPoints = simplifyPath(insidePoints, simplifyTolerance);
      }
      
      const clippedPoints = finalPoints.filter(p => 
        p.x >= margin && p.x <= width - margin &&
        p.y >= margin && p.y <= height - margin
      );
      
      if (clippedPoints.length >= 2) {
        paths.push({
          points: clippedPoints,
          penDown: true,
          layer: 99, // Top layer for fill
          color: 'hsl(var(--primary) / 0.7)',
        });
      }
    }
  }
}

// Helper: Get extra lines for variable density near shape
function getDensityExtraLines(
  lineIndex: number,
  totalLines: number,
  shapeCenter: { x: number; y: number },
  shapeRadius: number,
  baseSpacing: number,
  perpDir: { x: number; y: number },
  width: number,
  height: number
): number[] {
  const perpOffset = (lineIndex - (totalLines - 1) / 2) * baseSpacing;
  const lineY = height / 2 + perpDir.y * perpOffset;
  const lineX = width / 2 + perpDir.x * perpOffset;
  
  // Distance from line to shape center
  const distToCenter = Math.sqrt(
    (lineX - shapeCenter.x) ** 2 + (lineY - shapeCenter.y) ** 2
  );
  
  // Add extra lines if close to shape
  if (distToCenter < shapeRadius * 1.5) {
    const density = 1 - (distToCenter / (shapeRadius * 1.5));
    const extraLines = Math.floor(density * 3);
    const offsets: number[] = [0];
    for (let e = 1; e <= extraLines; e++) {
      offsets.push(baseSpacing * e * 0.25);
      offsets.push(-baseSpacing * e * 0.25);
    }
    return offsets;
  }
  
  return [0];
}

// Helper: Check if a point is inside a polygon (ray casting)
function isPointInsidePolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Main projection generator - dispatches to specific type.
 */
export function generateProjection(options: ProjectionOptions): PlotterDrawing {
  switch (options.params.type) {
    case 'crossSection':
      return generateCrossSectionSlices(options);
    case 'silhouette':
      return generateSilhouette(options);
    case 'contourStack':
      return generateContourStack(options);
    case 'lineField':
      return generateLineField(options);
    default:
      return generateCrossSectionSlices(options);
  }
}

// Helper: Rotate a 3D point around X and Y axes
function rotatePoint3D(
  point: { x: number; y: number; z: number },
  rotX: number,
  rotY: number
): { x: number; y: number; z: number } {
  // Rotate around Y axis first
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const y1 = point.y;
  
  // Then rotate around X axis
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;
  
  return { x: x1, y: y2, z: z2 };
}

// Helper: Calculate bounding box
function getBounds(points: { x: number; y: number }[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  return { minX, maxX, minY, maxY };
}
