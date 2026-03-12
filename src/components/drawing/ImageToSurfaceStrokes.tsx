/**
 * Image-to-Surface-Strokes converter
 * 
 * Uploads a photo, applies edge detection, traces contours into UV paths,
 * and converts them into SurfaceStroke[] for projection onto the 3D body.
 * Designed for ceramic-style incised/engraved surface decoration.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, RefreshCw, Wand2 } from 'lucide-react';
import { SurfaceStroke, TexturePattern } from '@/types/parametric';
import { cn } from '@/lib/utils';

interface ImageToSurfaceStrokesProps {
  onStrokesGenerated: (strokes: SurfaceStroke[]) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

const ImageToSurfaceStrokes = ({
  onStrokesGenerated,
  canvasWidth = 400,
  canvasHeight = 300,
}: ImageToSurfaceStrokesProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState(100);
  const [edgeStrength, setEdgeStrength] = useState(60);
  const [simplification, setSimplification] = useState(3); // skip every N pixels in contour
  const [minPathLength, setMinPathLength] = useState(8); // min points to keep a path
  const [strokeEffect, setStrokeEffect] = useState<SurfaceStroke['effect']>('raised');
  const [strokeDepth, setStrokeDepth] = useState(1.5);
  const [strokeThickness, setStrokeThickness] = useState(1.5);
  const [previewPaths, setPreviewPaths] = useState<{ u: number; v: number }[][]>([]);
  const [processing, setProcessing] = useState(false);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sobel edge detection (reused from ImageProcessor pattern)
  const detectEdges = useCallback((imageData: ImageData): ImageData => {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);

    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy) * (edgeStrength / 50);
        const idx = (y * width + x) * 4;
        const edge = magnitude > threshold ? 255 : 0;
        output[idx] = edge;
        output[idx + 1] = edge;
        output[idx + 2] = edge;
        output[idx + 3] = 255;
      }
    }

    return new ImageData(output, width, height);
  }, [threshold, edgeStrength]);

  /**
   * Trace contours from edge-detected binary image.
   * Uses a simple row-scan approach to build connected paths.
   */
  const traceContours = useCallback((edgeData: ImageData): { u: number; v: number }[][] => {
    const { data, width, height } = edgeData;
    const visited = new Uint8Array(width * height);
    const paths: { u: number; v: number }[][] = [];

    const isEdge = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return data[(y * width + x) * 4] > 128;
    };

    const isVisited = (x: number, y: number) => visited[y * width + x] === 1;
    const markVisited = (x: number, y: number) => { visited[y * width + x] = 1; };

    // 8-connected neighbor offsets
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];

    // Follow edge from a starting pixel
    const followEdge = (startX: number, startY: number): { u: number; v: number }[] => {
      const path: { u: number; v: number }[] = [];
      let cx = startX, cy = startY;
      let steps = 0;
      const maxSteps = width * height; // safety limit

      while (steps < maxSteps) {
        markVisited(cx, cy);

        // Only add every Nth point for simplification
        if (steps % simplification === 0) {
          path.push({
            u: cx / width,
            v: 1 - cy / height, // flip Y: canvas top = high v
          });
        }

        // Find next unvisited edge neighbor
        let found = false;
        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (isEdge(nx, ny) && !isVisited(nx, ny)) {
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }

        if (!found) break;
        steps++;
      }

      return path;
    };

    // Scan image for edge pixels and trace from each unvisited one
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (isEdge(x, y) && !isVisited(x, y)) {
          const path = followEdge(x, y);
          if (path.length >= minPathLength) {
            paths.push(path);
          }
        }
      }
    }

    return paths;
  }, [simplification, minPathLength]);

  // Process image: edge detect → trace → preview
  const processImage = useCallback(() => {
    if (!image || !originalCanvasRef.current || !edgeCanvasRef.current || !previewCanvasRef.current) return;
    setProcessing(true);

    const origCtx = originalCanvasRef.current.getContext('2d');
    const edgeCtx = edgeCanvasRef.current.getContext('2d');
    const prevCtx = previewCanvasRef.current.getContext('2d');
    if (!origCtx || !edgeCtx || !prevCtx) return;

    // Fit image into canvas
    const aspectRatio = image.width / image.height;
    let dw = canvasWidth, dh = canvasHeight;
    if (aspectRatio > canvasWidth / canvasHeight) {
      dh = canvasWidth / aspectRatio;
    } else {
      dw = canvasHeight * aspectRatio;
    }
    const ox = (canvasWidth - dw) / 2;
    const oy = (canvasHeight - dh) / 2;

    // Draw original
    origCtx.fillStyle = '#000';
    origCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    origCtx.drawImage(image, ox, oy, dw, dh);

    // Edge detect
    const imageData = origCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    const edgeData = detectEdges(imageData);
    edgeCtx.putImageData(edgeData, 0, 0);

    // Trace contours
    const paths = traceContours(edgeData);
    setPreviewPaths(paths);

    // Draw preview: dark bg with traced paths
    prevCtx.fillStyle = '#1a1a2e';
    prevCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    prevCtx.strokeStyle = '#2a2a4a';
    prevCtx.lineWidth = 0.5;
    for (let x = canvasWidth / 8; x < canvasWidth; x += canvasWidth / 8) {
      prevCtx.beginPath();
      prevCtx.moveTo(x, 0);
      prevCtx.lineTo(x, canvasHeight);
      prevCtx.stroke();
    }
    for (let y = canvasHeight / 6; y < canvasHeight; y += canvasHeight / 6) {
      prevCtx.beginPath();
      prevCtx.moveTo(0, y);
      prevCtx.lineTo(canvasWidth, y);
      prevCtx.stroke();
    }

    // Draw traced paths
    prevCtx.strokeStyle = '#f97316'; // orange for engraved look
    prevCtx.lineWidth = 1.5;
    prevCtx.lineCap = 'round';
    prevCtx.lineJoin = 'round';

    for (const path of paths) {
      if (path.length < 2) continue;
      prevCtx.beginPath();
      prevCtx.moveTo(path[0].u * canvasWidth, (1 - path[0].v) * canvasHeight);
      for (let i = 1; i < path.length; i++) {
        prevCtx.lineTo(path[i].u * canvasWidth, (1 - path[i].v) * canvasHeight);
      }
      prevCtx.stroke();
    }

    setProcessing(false);
  }, [image, canvasWidth, canvasHeight, detectEdges, traceContours]);

  // Auto-process when settings change
  useEffect(() => {
    if (image) processImage();
  }, [image, threshold, edgeStrength, simplification, minPathLength, processImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  };

  // Convert traced paths to SurfaceStroke[]
  const handleApply = useCallback(() => {
    const strokes: SurfaceStroke[] = previewPaths.map((path, idx) => ({
      id: `img-stroke-${Date.now()}-${idx}`,
      points: path,
      thickness: strokeThickness,
      effect: strokeEffect,
      depth: strokeDepth,
      offsetU: 0,
      offsetV: 0,
      strokeScale: 1,
    }));
    onStrokesGenerated(strokes);
  }, [previewPaths, strokeEffect, strokeDepth, strokeThickness, onStrokesGenerated]);

  return (
    <div className="space-y-3">
      {/* Upload */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3 h-3 mr-1" />
          Upload Photo
        </Button>
        {image && (
          <Button variant="outline" size="sm" onClick={processImage} disabled={processing}>
            <RefreshCw className={cn("w-3 h-3 mr-1", processing && "animate-spin")} />
            Reprocess
          </Button>
        )}
      </div>

      {!image && (
        <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center">
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Upload a photo to convert into surface art.<br />
            Works best with clear line art, logos, or high-contrast images.
          </p>
        </div>
      )}

      {image && (
        <>
          {/* Detection controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Edge Threshold</Label>
              <Slider
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
                min={20}
                max={200}
                step={5}
                className="py-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Edge Strength</Label>
              <Slider
                value={[edgeStrength]}
                onValueChange={([v]) => setEdgeStrength(v)}
                min={10}
                max={100}
                step={5}
                className="py-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Detail (lower = more)</Label>
              <Slider
                value={[simplification]}
                onValueChange={([v]) => setSimplification(v)}
                min={1}
                max={8}
                step={1}
                className="py-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Min Path Length</Label>
              <Slider
                value={[minPathLength]}
                onValueChange={([v]) => setMinPathLength(v)}
                min={3}
                max={30}
                step={1}
                className="py-1"
              />
            </div>
          </div>

          {/* Stroke settings */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Effect</Label>
              <Select value={strokeEffect} onValueChange={(v) => setStrokeEffect(v as SurfaceStroke['effect'])}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engraved">Engraved</SelectItem>
                  <SelectItem value="raised">Raised</SelectItem>
                  <SelectItem value="cut">Cut</SelectItem>
                  <SelectItem value="ribbon">Ribbon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Depth</Label>
              <Slider
                value={[strokeDepth]}
                onValueChange={([v]) => setStrokeDepth(v)}
                min={0.5}
                max={5}
                step={0.5}
                className="py-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Thickness</Label>
              <Slider
                value={[strokeThickness]}
                onValueChange={([v]) => setStrokeThickness(v)}
                min={0.5}
                max={4}
                step={0.5}
                className="py-1"
              />
            </div>
          </div>

          {/* Canvas previews */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Original</Label>
                <canvas
                  ref={originalCanvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="border border-border/50 rounded w-full"
                  style={{ aspectRatio: `${canvasWidth}/${canvasHeight}` }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Edges</Label>
                <canvas
                  ref={edgeCanvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="border border-border/50 rounded w-full"
                  style={{ aspectRatio: `${canvasWidth}/${canvasHeight}` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Traced paths ({previewPaths.length} strokes)
              </Label>
              <canvas
                ref={previewCanvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="border border-border rounded-lg w-full"
                style={{ aspectRatio: `${canvasWidth}/${canvasHeight}` }}
              />
            </div>
          </div>

          {/* Apply button */}
          <Button
            className="w-full"
            onClick={handleApply}
            disabled={previewPaths.length === 0}
          >
            <Wand2 className="w-3 h-3 mr-1.5" />
            Apply {previewPaths.length} strokes to surface
          </Button>
        </>
      )}
    </div>
  );
};

export default ImageToSurfaceStrokes;
