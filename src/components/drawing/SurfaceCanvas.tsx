import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas as FabricCanvas, Path, Line, PencilBrush } from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Undo, Redo, FlipHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { SurfaceStroke, TexturePattern, ParametricParams } from '@/types/parametric';
import { getUnwrapProfile, interpolateWidthFraction, canvasUToRealU, getUnwrapClipPath } from '@/lib/surface-unwrap';
import { cn } from '@/lib/utils';

export interface SurfaceHoverPosition {
  u: number;
  v: number;
}

interface SurfaceCanvasProps {
  strokes: SurfaceStroke[];
  onChange: (strokes: SurfaceStroke[]) => void;
  onHover?: (pos: SurfaceHoverPosition | null) => void;
  params?: ParametricParams;
  width?: number;
  height?: number;
}

const EFFECT_COLORS: Record<SurfaceStroke['effect'], string> = {
  raised: '#60a5fa',
  engraved: '#f97316',
  ribbon: '#a78bfa',
  cut: '#ef4444',
  texture: '#4ade80',
};

const CANVAS_W = 400;
const CANVAS_H = 300;

const SurfaceCanvas = ({ strokes, onChange, onHover, params, width = CANVAS_W, height = CANVAS_H }: SurfaceCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [brushWidth, setBrushWidth] = useState(4);
  const [currentEffect, setCurrentEffect] = useState<SurfaceStroke['effect']>('engraved');
  const [currentDepth, setCurrentDepth] = useState(2);
  const [currentTexturePattern, setCurrentTexturePattern] = useState<TexturePattern>('dots');
  const [symmetry, setSymmetry] = useState(false);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showStrokeList, setShowStrokeList] = useState(false);
  const isLoadingRef = useRef(false);
  const strokesRef = useRef<SurfaceStroke[]>(strokes);

  strokesRef.current = strokes;

  // Compute unwrap profile from params
  const unwrapProfile = useMemo(() => {
    if (!params) return null;
    return getUnwrapProfile(params, 80);
  }, [params]);

  // Draw unwrap shape overlay (silhouette + shaded outside area + grid)
  useEffect(() => {
    if (!overlayRef.current || !unwrapProfile) return;
    const ctx = overlayRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Get clip path points
    const clipPoints = getUnwrapClipPath(unwrapProfile, width, height);
    if (clipPoints.length < 4) return;

    // Fill entire canvas with dark overlay (outside area)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, width, height);

    // Cut out the unwrap shape (clear it)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(clipPoints[0].x, clipPoints[0].y);
    for (let i = 1; i < clipPoints.length; i++) {
      ctx.lineTo(clipPoints[i].x, clipPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw the unwrap shape border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(clipPoints[0].x, clipPoints[0].y);
    for (let i = 1; i < clipPoints.length; i++) {
      ctx.lineTo(clipPoints[i].x, clipPoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw horizontal height markers inside the shape
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    const heightMarkers = [0.25, 0.5, 0.75];
    for (const t of heightMarkers) {
      const wf = interpolateWidthFraction(unwrapProfile, t);
      const y = (1 - t) * height;
      const xLeft = (1 - wf) / 2 * width;
      const xRight = (1 + wf) / 2 * width;
      ctx.beginPath();
      ctx.moveTo(xLeft, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
    }

    // Draw vertical grid lines that follow the unwrap shape
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    const vLines = 6;
    for (let vi = 1; vi < vLines; vi++) {
      const frac = vi / vLines; // fraction across width
      ctx.beginPath();
      let started = false;
      for (let si = 0; si < unwrapProfile.length; si++) {
        const s = unwrapProfile[si];
        const xLeft = (1 - s.widthFraction) / 2 * width;
        const xRight = (1 + s.widthFraction) / 2 * width;
        const x = xLeft + (xRight - xLeft) * frac;
        const y = (1 - s.t) * height;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Height labels
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const wf = interpolateWidthFraction(unwrapProfile, t);
      const y = (1 - t) * height;
      const xRight = (1 + wf) / 2 * width + 14;
      ctx.fillText(`${Math.round(t * 100)}%`, xRight, y + 3);
    }
  }, [unwrapProfile, width, height]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#1a1a2e',
      selection: false,
      isDrawingMode: true,
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = EFFECT_COLORS.engraved;
    canvas.freeDrawingBrush.width = brushWidth;

    setFabricCanvas(canvas);

    const initialState = JSON.stringify(canvas.toJSON());
    setHistory([initialState]);
    setHistoryIndex(0);

    return () => { canvas.dispose(); };
  }, [width, height]);

  // Mouse move handler for hover position (with unwrap compensation)
  useEffect(() => {
    if (!canvasRef.current || !onHover) return;
    const el = canvasRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const uCanvas = Math.max(0, Math.min(1, x / width));
      const v = Math.max(0, Math.min(1, 1 - y / height));

      // Compensate for unwrap shape
      if (unwrapProfile) {
        const wf = interpolateWidthFraction(unwrapProfile, v);
        const uReal = canvasUToRealU(uCanvas, wf);
        onHover({ u: uReal, v });
      } else {
        onHover({ u: uCanvas, v });
      }
    };

    const handleMouseLeave = () => { onHover(null); };

    const container = el.parentElement;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [onHover, width, height, unwrapProfile]);

  // Update brush on effect/opacity change
  useEffect(() => {
    if (!fabricCanvas?.freeDrawingBrush) return;
    fabricCanvas.freeDrawingBrush.width = brushWidth;
    const hex = EFFECT_COLORS[currentEffect] || EFFECT_COLORS.engraved;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    fabricCanvas.freeDrawingBrush.color = `rgba(${r},${g},${b},${brushOpacity})`;
  }, [brushWidth, currentEffect, fabricCanvas, brushOpacity]);

  // Extract strokes from canvas paths (with unwrap UV compensation)
  const extractStrokes = useCallback(() => {
    if (!fabricCanvas) return;

    const newStrokes: SurfaceStroke[] = [];
    const objects = fabricCanvas.getObjects();

    objects.forEach((obj, idx) => {
      if (!(obj instanceof Path)) return;
      const pathData = obj.path;
      if (!pathData) return;

      const points: { u: number; v: number }[] = [];
      const matrix = obj.calcTransformMatrix();

      pathData.forEach((cmd: any) => {
        if (cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Q') {
          let px = cmd[cmd.length - 2];
          let py = cmd[cmd.length - 1];

          const transformed = {
            x: matrix[0] * px + matrix[2] * py + matrix[4],
            y: matrix[1] * px + matrix[3] * py + matrix[5],
          };

          // Store raw canvas-space UV — the stroke generator will compensate for unwrap
          const u = Math.max(0, Math.min(1, transformed.x / width));
          const v = Math.max(0, Math.min(1, 1 - transformed.y / height));

          points.push({ u, v });
        }
      });

      if (points.length >= 2) {
        const existing = strokesRef.current[newStrokes.length];
        newStrokes.push({
          id: existing?.id || `stroke-${Date.now()}-${idx}`,
          points,
          thickness: existing?.thickness || brushWidth * 0.5,
          effect: 'engraved',
          depth: existing?.depth || currentDepth,
          offsetU: 0,
          offsetV: 0,
          strokeScale: 1,
        });
      }
    });

    onChange(newStrokes);
  }, [fabricCanvas, width, height, onChange, currentDepth, brushWidth]);

  // Mirror stroke points horizontally for symmetry
  const mirrorPath = useCallback((path: Path): Path | null => {
    if (!path.path) return null;
    const mirroredPathData = path.path.map((cmd: any) => {
      const newCmd = [...cmd] as any;
      for (let i = 1; i < newCmd.length; i += 2) {
        if (typeof newCmd[i] === 'number') {
          newCmd[i] = width - newCmd[i];
        }
      }
      return newCmd;
    }) as any;

    const mirroredPath = new Path(mirroredPathData, {
      stroke: path.stroke,
      strokeWidth: path.strokeWidth,
      fill: '',
      selectable: true,
      evented: true,
      opacity: path.opacity,
    });
    return mirroredPath;
  }, [width]);

  // Listen for new paths
  useEffect(() => {
    if (!fabricCanvas) return;

    const handlePathCreated = (e: any) => {
      if (isLoadingRef.current) return;

      if (symmetry && e.path) {
        const mirrored = mirrorPath(e.path);
        if (mirrored) {
          fabricCanvas.add(mirrored);
          fabricCanvas.renderAll();
        }
      }

      extractStrokes();

      const json = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => [...prev.slice(0, historyIndex + 1), json]);
      setHistoryIndex(prev => prev + 1);
    };

    fabricCanvas.on('path:created', handlePathCreated);
    return () => { fabricCanvas.off('path:created', handlePathCreated); };
  }, [fabricCanvas, extractStrokes, historyIndex, symmetry, mirrorPath]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects().filter(obj => obj.selectable !== false);
    objects.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.renderAll();
    onChange([]);

    const json = JSON.stringify(fabricCanvas.toJSON());
    setHistory(prev => [...prev.slice(0, historyIndex + 1), json]);
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0 || !fabricCanvas) return;
    const newIndex = historyIndex - 1;
    isLoadingRef.current = true;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
      extractStrokes();
      isLoadingRef.current = false;
    });
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1 || !fabricCanvas) return;
    const newIndex = historyIndex + 1;
    isLoadingRef.current = true;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex]), () => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
      extractStrokes();
      isLoadingRef.current = false;
    });
  };

  const handleRemoveStroke = (idx: number) => {
    const updated = strokes.filter((_, i) => i !== idx);
    onChange(updated);
    if (fabricCanvas) {
      const paths = fabricCanvas.getObjects().filter(obj => obj instanceof Path);
      if (paths[idx]) {
        fabricCanvas.remove(paths[idx]);
        fabricCanvas.renderAll();
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0}>
          <Undo className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
          <Redo className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
        <div className="flex items-center gap-1.5 ml-auto">
          <FlipHorizontal className="w-3 h-3 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Symmetry</Label>
          <Switch checked={symmetry} onCheckedChange={setSymmetry} className="scale-75" />
        </div>
      </div>

      {/* Effect & depth controls */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Modo</Label>
          <Select value={currentEffect} onValueChange={(v) => setCurrentEffect(v as SurfaceStroke['effect'])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engraved">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.engraved }} />
                  Grabado
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Depth: {currentDepth}mm</Label>
          <Slider
            value={[currentDepth]}
            onValueChange={([v]) => setCurrentDepth(v)}
            min={0.5}
            max={8}
            step={0.5}
            className="py-2"
          />
        </div>
      </div>

      {/* Texture pattern selector */}
      {currentEffect === 'texture' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Texture Pattern</Label>
          <Select value={currentTexturePattern} onValueChange={(v) => setCurrentTexturePattern(v as TexturePattern)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dots">Dots</SelectItem>
              <SelectItem value="crosshatch">Crosshatch</SelectItem>
              <SelectItem value="zigzag">Zigzag</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Brush size & opacity */}
      <div className="flex items-center gap-3 flex-wrap">
        <Pencil className="w-3 h-3 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground">Brush</Label>
        <Slider
          value={[brushWidth]}
          onValueChange={([v]) => setBrushWidth(v)}
          min={2}
          max={12}
          step={1}
          className="w-20 py-2"
        />
        <span className="text-xs text-muted-foreground tabular-nums">{brushWidth}px</span>
        <Label className="text-xs text-muted-foreground ml-2">Opacity</Label>
        <Slider
          value={[brushOpacity]}
          onValueChange={([v]) => setBrushOpacity(v)}
          min={0.2}
          max={1}
          step={0.1}
          className="w-16 py-2"
        />
      </div>

      {/* Canvas with unwrap overlay */}
      <div className="border border-border rounded-lg overflow-hidden relative">
        <canvas ref={canvasRef} />
        <canvas
          ref={overlayRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none"
          style={{ width, height }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-1 px-1">
        <span>0°</span>
        <span>← dibuja dentro de la forma →</span>
        <span>360°</span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 text-center -mt-0.5">
        La forma muestra el desdoblado real de la pieza. Dibuja dentro de la silueta y se grabará proporcionalmente.
      </p>

      {/* Stroke list */}
      {strokes.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowStrokeList(!showStrokeList)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showStrokeList ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{strokes.length} trazo{strokes.length !== 1 ? 's' : ''}</span>
          </button>

          {showStrokeList && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {strokes.map((stroke, idx) => (
                <div key={stroke.id} className="flex items-center justify-between bg-background/50 rounded px-2 py-1 border border-border/50">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: EFFECT_COLORS[stroke.effect] }}
                    />
                    <span className="text-xs text-foreground">
                      Trazo {idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({stroke.effect})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => handleRemoveStroke(idx)}
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SurfaceCanvas;
