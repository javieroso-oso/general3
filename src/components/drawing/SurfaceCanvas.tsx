import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Path, Line, PencilBrush } from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Undo, Redo, FlipHorizontal } from 'lucide-react';
import { SurfaceStroke, TexturePattern } from '@/types/parametric';

interface SurfaceCanvasProps {
  strokes: SurfaceStroke[];
  onChange: (strokes: SurfaceStroke[]) => void;
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

const SurfaceCanvas = ({ strokes, onChange, width = CANVAS_W, height = CANVAS_H }: SurfaceCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [brushWidth, setBrushWidth] = useState(4);
  const [currentEffect, setCurrentEffect] = useState<SurfaceStroke['effect']>('raised');
  const [currentDepth, setCurrentDepth] = useState(2);
  const [currentTexturePattern, setCurrentTexturePattern] = useState<TexturePattern>('dots');
  const [symmetry, setSymmetry] = useState(false);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isLoadingRef = useRef(false);
  const strokesRef = useRef<SurfaceStroke[]>(strokes);

  strokesRef.current = strokes;

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

    // Draw grid
    const gridX = width / 8;
    const gridY = height / 6;
    for (let x = gridX; x < width; x += gridX) {
      canvas.add(new Line([x, 0, x, height], {
        stroke: '#2a2a4a', strokeWidth: 0.5, selectable: false, evented: false,
      }));
    }
    for (let y = gridY; y < height; y += gridY) {
      canvas.add(new Line([0, y, width, y], {
        stroke: '#2a2a4a', strokeWidth: 0.5, selectable: false, evented: false,
      }));
    }

    // Wrap-around indicator line at left & right edges
    canvas.add(new Line([0, 0, 0, height], {
      stroke: '#4ade80', strokeWidth: 1.5, selectable: false, evented: false, strokeDashArray: [4, 4],
    }));
    canvas.add(new Line([width, 0, width, height], {
      stroke: '#4ade80', strokeWidth: 1.5, selectable: false, evented: false, strokeDashArray: [4, 4],
    }));

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = EFFECT_COLORS.raised;
    canvas.freeDrawingBrush.width = brushWidth;

    setFabricCanvas(canvas);

    const initialState = JSON.stringify(canvas.toJSON());
    setHistory([initialState]);
    setHistoryIndex(0);

    return () => { canvas.dispose(); };
  }, [width, height]);

  // Update brush on effect/opacity change
  useEffect(() => {
    if (!fabricCanvas?.freeDrawingBrush) return;
    fabricCanvas.freeDrawingBrush.width = brushWidth;
    const hex = EFFECT_COLORS[currentEffect] || EFFECT_COLORS.raised;
    // Apply opacity via rgba
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    fabricCanvas.freeDrawingBrush.color = `rgba(${r},${g},${b},${brushOpacity})`;
  }, [brushWidth, currentEffect, fabricCanvas, brushOpacity]);

  // Extract strokes from canvas paths
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
          effect: existing?.effect || currentEffect,
          depth: existing?.depth || currentDepth,
          ...(currentEffect === 'texture' ? { texturePattern: currentTexturePattern } : {}),
        });
      }
    });

    onChange(newStrokes);
  }, [fabricCanvas, width, height, onChange, currentEffect, currentDepth, brushWidth, currentTexturePattern]);

  // Mirror stroke points horizontally for symmetry
  const mirrorPath = useCallback((path: Path): Path | null => {
    if (!path.path) return null;
    const mirroredPathData = path.path.map((cmd: any) => {
      const newCmd = [...cmd];
      // Mirror x coordinates (last-2 and any intermediate control points)
      for (let i = 1; i < newCmd.length; i += 2) {
        if (typeof newCmd[i] === 'number') {
          newCmd[i] = width - newCmd[i];
        }
      }
      return newCmd;
    });
    
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
      
      // Add mirrored stroke if symmetry is on
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
          <Label className="text-xs text-muted-foreground">Effect</Label>
          <Select value={currentEffect} onValueChange={(v) => setCurrentEffect(v as SurfaceStroke['effect'])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="raised">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.raised }} />
                  Raised (emboss)
                </span>
              </SelectItem>
              <SelectItem value="engraved">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.engraved }} />
                  Engraved (groove)
                </span>
              </SelectItem>
              <SelectItem value="ribbon">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.ribbon }} />
                  Ribbon (flat)
                </span>
              </SelectItem>
              <SelectItem value="cut">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.cut }} />
                  Cut (through)
                </span>
              </SelectItem>
              <SelectItem value="texture">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EFFECT_COLORS.texture }} />
                  Texture (pattern)
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

      {/* Texture pattern selector - only when texture effect */}
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

      {/* Canvas */}
      <div className="border border-border rounded-lg overflow-hidden">
        <canvas ref={canvasRef} />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-1 px-1">
        <span>0°</span>
        <span>← angle (wraps around) →</span>
        <span>360°</span>
      </div>

      {/* Stroke count */}
      {strokes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {strokes.length} stroke{strokes.length !== 1 ? 's' : ''} on surface
        </p>
      )}
    </div>
  );
};

export default SurfaceCanvas;
