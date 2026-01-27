/**
 * 3D-to-2D Projection for Plotter Output
 * 
 * Converts parametric 3D shapes into 2D plotter paths using:
 * - Cross-section slices (horizontal cuts)
 * - Silhouette extraction (outer boundary from view angle)
 * - Contour stacks (offset slices for layered effect)
 */

import { PlotterDrawing, PlotterPath, ProjectionParams, PAPER_SIZES } from '@/types/plotter';
import { ParametricParams, ObjectType3D } from '@/types/parametric';
import { getBodyRadius, getMaxBodyRadius } from '@/lib/body-profile-generator';

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
