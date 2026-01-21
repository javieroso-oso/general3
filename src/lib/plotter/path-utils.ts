import { PlotterPath, PlotterDrawing } from '@/types/plotter';

// Simplify a path using Ramer-Douglas-Peucker algorithm
export function simplifyPath(
  points: { x: number; y: number }[],
  tolerance: number
): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  
  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }
  
  return [start, end];
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLengthSq = dx * dx + dy * dy;
  
  if (lineLengthSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq
  ));
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

// Smooth a path using Catmull-Rom spline
export function smoothPath(
  points: { x: number; y: number }[],
  segments: number = 10
): { x: number; y: number }[] {
  if (points.length < 4) return points;
  
  const result: { x: number; y: number }[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    
    for (let t = 0; t < 1; t += 1 / segments) {
      const point = catmullRom(p0, p1, p2, p3, t);
      result.push(point);
    }
  }
  
  result.push(points[points.length - 1]);
  return result;
}

function catmullRom(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  
  const x = 0.5 * (
    2 * p1.x +
    (-p0.x + p2.x) * t +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
  );
  
  const y = 0.5 * (
    2 * p1.y +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
  
  return { x, y };
}

// Optimize path order to minimize pen-up travel (greedy nearest neighbor)
export function optimizePaths(paths: PlotterPath[]): PlotterPath[] {
  if (paths.length <= 1) return paths;
  
  const optimized: PlotterPath[] = [];
  const remaining = [...paths];
  
  // Start with first path
  let current = remaining.shift()!;
  optimized.push(current);
  
  while (remaining.length > 0) {
    const currentEnd = current.points[current.points.length - 1];
    
    // Find nearest path start or end
    let nearestIndex = 0;
    let nearestDist = Infinity;
    let reverseNearest = false;
    
    for (let i = 0; i < remaining.length; i++) {
      const path = remaining[i];
      const start = path.points[0];
      const end = path.points[path.points.length - 1];
      
      const distToStart = distance(currentEnd, start);
      const distToEnd = distance(currentEnd, end);
      
      if (distToStart < nearestDist) {
        nearestDist = distToStart;
        nearestIndex = i;
        reverseNearest = false;
      }
      
      if (distToEnd < nearestDist) {
        nearestDist = distToEnd;
        nearestIndex = i;
        reverseNearest = true;
      }
    }
    
    // Add nearest path (possibly reversed)
    const nextPath = remaining.splice(nearestIndex, 1)[0];
    if (reverseNearest) {
      nextPath.points = nextPath.points.slice().reverse();
    }
    optimized.push(nextPath);
    current = nextPath;
  }
  
  return optimized;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// Clip paths to bounds
export function clipToBounds(
  drawing: PlotterDrawing,
  margin: number
): PlotterDrawing {
  const { width, height } = drawing;
  const minX = margin;
  const maxX = width - margin;
  const minY = margin;
  const maxY = height - margin;
  
  const clippedPaths: PlotterPath[] = [];
  
  for (const path of drawing.paths) {
    const clippedPoints: { x: number; y: number }[] = [];
    
    for (const point of path.points) {
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        clippedPoints.push(point);
      } else if (clippedPoints.length > 0) {
        // End current segment, start new one
        if (clippedPoints.length >= 2) {
          clippedPaths.push({
            ...path,
            points: [...clippedPoints],
          });
        }
        clippedPoints.length = 0;
      }
    }
    
    if (clippedPoints.length >= 2) {
      clippedPaths.push({
        ...path,
        points: clippedPoints,
      });
    }
  }
  
  return {
    ...drawing,
    paths: clippedPaths,
  };
}

// Calculate total path length and travel distance
export function calculateStats(drawing: PlotterDrawing): {
  pathCount: number;
  totalPathLength: number;
  totalTravelDistance: number;
  estimatedTimeMinutes: number;
} {
  let totalPathLength = 0;
  let totalTravelDistance = 0;
  let lastPoint: { x: number; y: number } | null = null;
  
  for (const path of drawing.paths) {
    // Travel to start
    if (lastPoint && path.points.length > 0) {
      totalTravelDistance += distance(lastPoint, path.points[0]);
    }
    
    // Path length
    for (let i = 1; i < path.points.length; i++) {
      totalPathLength += distance(path.points[i - 1], path.points[i]);
    }
    
    if (path.points.length > 0) {
      lastPoint = path.points[path.points.length - 1];
    }
  }
  
  // Estimate time (assuming 30mm/s draw, 60mm/s travel)
  const drawTime = totalPathLength / 30;
  const travelTime = totalTravelDistance / 60;
  const estimatedTimeMinutes = (drawTime + travelTime) / 60;
  
  return {
    pathCount: drawing.paths.length,
    totalPathLength: Math.round(totalPathLength),
    totalTravelDistance: Math.round(totalTravelDistance),
    estimatedTimeMinutes: Math.round(estimatedTimeMinutes * 10) / 10,
  };
}
