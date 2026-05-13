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

// Bounds for auto-sized canvas (px)
const MIN_W = 320;
const MAX_W = 900;
const MIN_H = 240;
const MAX_H = 700;
const BASE_AREA = 400 * 300; // keep similar visual weight to old default

const SurfaceCanvas = ({ strokes, onChange, onHover, params, width: widthProp, height: heightProp }: SurfaceCanvasProps) => {
  // Auto-size canvas to match the body's real circumference:height aspect ratio
  // so the unwrap silhouette actually fills the drawing area.
  const autoSize = useMemo(() => {
    if (!params) return { width: CANVAS_W, height: CANVAS_H };
    // Sample max radius from a quick unwrap
    const profile = getUnwrapProfile(params, 40);
    let rMax = 0;
    for (const s of profile) if (s.radius > rMax) rMax = s.radius;
    const circumference = 2 * Math.PI * rMax;
    const h = params.height;
    if (!circumference || !h) return { width: CANVAS_W, height: CANVAS_H };
    const aspect = circumference / h; // width/height
    // Pick dims preserving roughly the old visual area, then clamp.
    let hPx = Math.sqrt(BASE_AREA / aspect);
    let wPx = hPx * aspect;
    // Clamp width first, recompute height
    if (wPx > MAX_W) { wPx = MAX_W; hPx = wPx / aspect; }
    if (wPx < MIN_W) { wPx = MIN_W; hPx = wPx / aspect; }
    if (hPx > MAX_H) { hPx = MAX_H; wPx = hPx * aspect; }
    if (hPx < MIN_H) { hPx = MIN_H; wPx = hPx * aspect; }
    // Final hard clamp on both
    wPx = Math.max(MIN_W, Math.min(MAX_W, wPx));
    hPx = Math.max(MIN_H, Math.min(MAX_H, hPx));
    return { width: Math.round(wPx), height: Math.round(hPx) };
  }, [params]);

  const width = widthProp ?? autoSize.width;
  const height = heightProp ?? autoSize.height;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  // Brush thickness in millimetres (matches what gets baked into the wall).
  const [brushThicknessMm, setBrushThicknessMm] = useState(2);
  const [currentEffect, setCurrentEffect] = useState<SurfaceStroke['effect']>('engraved');
  const [currentDepth, setCurrentDepth] = useState(2);
  const [symmetry, setSymmetry] = useState(false);
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
    canvas.freeDrawingBrush.width = brushThicknessMm * 3;

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

  // Update brush color & width whenever effect or thickness changes.
  useEffect(() => {
    if (!fabricCanvas?.freeDrawingBrush) return;
    fabricCanvas.freeDrawingBrush.width = brushThicknessMm * 3;
    fabricCanvas.freeDrawingBrush.color = EFFECT_COLORS[currentEffect] || EFFECT_COLORS.engraved;
  }, [brushThicknessMm, currentEffect, fabricCanvas]);

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
      // Fabric Path renders points relative to pathOffset (bbox center in path-local space).
      // calcTransformMatrix() does NOT include pathOffset, so we must subtract it manually
      // or all captured points will be shifted by the bbox half-extents.
      const pOffX = (obj as any).pathOffset?.x ?? 0;
      const pOffY = (obj as any).pathOffset?.y ?? 0;

      // Walk the path. For Q (quadratic) commands, sample multiple points along
      // the curve so the captured stroke matches the smoothness drawn by the user
      // (Fabric's PencilBrush emits curves; storing only endpoints lost detail
      // and made exports look pixelated/jagged).
      let prevX: number | null = null;
      let prevY: number | null = null;

      const pushPoint = (px: number, py: number) => {
        const transformed = {
          x: matrix[0] * px + matrix[2] * py + matrix[4],
          y: matrix[1] * px + matrix[3] * py + matrix[5],
        };
        const u = Math.max(0, Math.min(1, transformed.x / width));
        const v = Math.max(0, Math.min(1, 1 - transformed.y / height));
        points.push({ u, v });
      };

      pathData.forEach((cmd: any) => {
        if (cmd[0] === 'M' || cmd[0] === 'L') {
          const px = cmd[cmd.length - 2] - pOffX;
          const py = cmd[cmd.length - 1] - pOffY;
          pushPoint(px, py);
          prevX = px; prevY = py;
        } else if (cmd[0] === 'Q') {
          const cx = cmd[1] - pOffX;
          const cy = cmd[2] - pOffY;
          const ex = cmd[3] - pOffX;
          const ey = cmd[4] - pOffY;
          const sx = prevX ?? ex;
          const sy = prevY ?? ey;
          // Sample 6 intermediate points along the quadratic Bezier
          const STEPS = 6;
          for (let s = 1; s <= STEPS; s++) {
            const t = s / STEPS;
            const omt = 1 - t;
            const qx = omt * omt * sx + 2 * omt * t * cx + t * t * ex;
            const qy = omt * omt * sy + 2 * omt * t * cy + t * t * ey;
            pushPoint(qx, qy);
          }
          prevX = ex; prevY = ey;
        }
      });

      if (points.length >= 2) {
        const existing = strokesRef.current[newStrokes.length];
        newStrokes.push({
          id: existing?.id || `stroke-${Date.now()}-${idx}`,
          points,
          thickness: existing?.thickness ?? brushThicknessMm,
          effect: existing?.effect ?? currentEffect,
          depth: existing?.depth ?? currentDepth,
          offsetU: existing?.offsetU ?? 0,
          offsetV: existing?.offsetV ?? 0,
          strokeScale: existing?.strokeScale ?? 1,
        });
      }
    });

    onChange(newStrokes);
  }, [fabricCanvas, width, height, onChange, currentDepth, brushThicknessMm, currentEffect]);

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
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Select value={currentEffect} onValueChange={(v) => setCurrentEffect(v as SurfaceStroke['effect'])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engraved">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.engraved }} />
                  Engraved (carve in)
                </span>
              </SelectItem>
              <SelectItem value="raised">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.raised }} />
                  Raised (push out)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Depth: {currentDepth.toFixed(1)}mm</Label>
          <Slider
            value={[currentDepth]}
            onValueChange={([v]) => setCurrentDepth(v)}
            min={0.5}
            max={currentEffect === 'raised' ? 1.2 : 6}
            step={0.1}
            className="py-2"
          />
        </div>
      </div>

      {/* Brush thickness */}
      <div className="flex items-center gap-3 flex-wrap">
        <Pencil className="w-3 h-3 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground">Thickness</Label>
        <Slider
          value={[brushThicknessMm]}
          onValueChange={([v]) => setBrushThicknessMm(v)}
          min={0.5}
          max={6}
          step={0.5}
          className="w-32 py-2"
        />
        <span className="text-xs text-muted-foreground tabular-nums">{brushThicknessMm.toFixed(1)}mm</span>
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
        <span>← Draw inside the silhouette →</span>
        <span>360°</span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 text-center -mt-0.5">
        The silhouette is the real unwrap of the body. Engraved & raised strokes physically modify the wall.
      </p>

      {/* Stroke list — editable */}
      {strokes.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowStrokeList(!showStrokeList)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showStrokeList ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{strokes.length} stroke{strokes.length !== 1 ? 's' : ''}</span>
          </button>

          {showStrokeList && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {strokes.map((stroke, idx) => {
                const wallMm = params?.wallThickness ?? 1.6;
                const maxEngrave = Math.max(0.2, wallMm - 0.4);
                const maxRaise = 1.2;
                const maxForEffect = stroke.effect === 'raised' ? maxRaise : maxEngrave;
                const clamped = (stroke.effect === 'engraved' || stroke.effect === 'cut' || stroke.effect === 'raised')
                  && stroke.depth > maxForEffect;
                const updateStroke = (patch: Partial<SurfaceStroke>) => {
                  const next = strokes.map((s, i) => i === idx ? { ...s, ...patch } : s);
                  onChange(next);
                };
                return (
                  <div key={stroke.id} className="bg-background/50 rounded px-2 py-1.5 border border-border/50 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: EFFECT_COLORS[stroke.effect] }}
                      />
                      <span className="text-xs text-foreground">Stroke {idx + 1}</span>
                      {clamped && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive"
                          title={`Depth clamped to ${maxForEffect.toFixed(1)}mm for printability${stroke.effect === 'raised' ? '' : ` (wall is ${wallMm}mm)`}.`}
                        >
                          clamped → {maxForEffect.toFixed(1)}mm
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-auto"
                        onClick={() => handleRemoveStroke(idx)}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Select
                        value={stroke.effect}
                        onValueChange={(v) => updateStroke({ effect: v as SurfaceStroke['effect'] })}
                      >
                        <SelectTrigger className="h-6 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engraved">Engraved</SelectItem>
                          <SelectItem value="raised">Raised</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground w-7 shrink-0">D {stroke.depth.toFixed(1)}</span>
                        <Slider
                          value={[stroke.depth]}
                          onValueChange={([v]) => updateStroke({ depth: v })}
                          min={0.5}
                          max={stroke.effect === 'raised' ? 1.2 : 6}
                          step={0.1}
                          className="py-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground w-7 shrink-0">T {stroke.thickness.toFixed(1)}</span>
                        <Slider
                          value={[stroke.thickness]}
                          onValueChange={([v]) => updateStroke({ thickness: v })}
                          min={0.5}
                          max={6}
                          step={0.5}
                          className="py-1.5"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SurfaceCanvas;
