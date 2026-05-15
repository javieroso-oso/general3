import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Trash2, Undo, Maximize2, Minimize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BaseStroke, ParametricParams } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

interface BaseCanvasProps {
  strokes: BaseStroke[];
  onChange: (strokes: BaseStroke[]) => void;
  params: ParametricParams;
}

const SAMPLES = 96;

const BaseCanvas = ({ strokes, onChange, params }: BaseCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  const [expanded, setExpanded] = useState(false);
  const [thickness, setThickness] = useState(2);
  const [height, setHeight] = useState(1.5);
  const drawingRef = useRef<{ x: number; y: number }[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setSize(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sample base silhouette in normalized coords [-1..1]
  const silhouette = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const baseR = params.baseRadius || 1;
    for (let i = 0; i <= SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      // Sample at the very bottom (t=0) without twist, scale=1 so we get mm
      const r = getBodyRadius(params, 0, a, { scale: 1, includeTwist: false });
      const rn = r / baseR;
      pts.push({ x: Math.cos(a) * rn, y: Math.sin(a) * rn });
    }
    return pts;
  }, [params]);

  // Draw everything to the canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 8;

    const toPx = (p: { x: number; y: number }) => ({
      x: cx + p.x * radius,
      y: cy - p.y * radius,
    });

    // Background
    ctx.fillStyle = 'hsl(0 0% 98%)';
    ctx.fillRect(0, 0, w, h);

    // Outer reference circle (faint)
    ctx.strokeStyle = 'hsl(0 0% 85%)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Silhouette outline (real base shape)
    ctx.beginPath();
    silhouette.forEach((p, i) => {
      const px = toPx(p);
      if (i === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'hsl(0 0% 92%)';
    ctx.fill();
    ctx.strokeStyle = 'hsl(0 0% 60%)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center cross
    ctx.strokeStyle = 'hsl(0 0% 80%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Existing strokes
    ctx.strokeStyle = '#0066ff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      const pxThickness = Math.max(2, (s.thickness / params.baseRadius) * radius);
      ctx.lineWidth = pxThickness;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const px = toPx(p);
        if (i === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    }

    // In-progress stroke
    if (drawingRef.current && drawingRef.current.length > 0) {
      const pxThickness = Math.max(2, (thickness / params.baseRadius) * radius);
      ctx.lineWidth = pxThickness;
      ctx.strokeStyle = '#ff0080';
      ctx.beginPath();
      drawingRef.current.forEach((p, i) => {
        const px = toPx(p);
        if (i === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    }
  }, [silhouette, strokes, thickness, params.baseRadius]);

  useEffect(() => { redraw(); }, [redraw, size, expanded]);

  const px = expanded ? Math.min(window.innerWidth * 0.9, window.innerHeight * 0.8, 720) : size;

  // Pointer handlers
  const pointerToNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 8;
    const nx = (x - cx) / radius;
    const ny = -(y - cy) / radius;
    // Clamp to unit disc to prevent going off the base
    const r = Math.hypot(nx, ny);
    if (r > 1) {
      const k = 0.99 / r;
      return { x: nx * k, y: ny * k };
    }
    return { x: nx, y: ny };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = pointerToNorm(e);
    if (!p) return;
    drawingRef.current = [p];
    force((n) => n + 1);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = pointerToNorm(e);
    if (!p) return;
    const last = drawingRef.current[drawingRef.current.length - 1];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy < 0.0005) return; // dedupe
    drawingRef.current.push(p);
    redraw();
  };
  const handlePointerUp = () => {
    if (!drawingRef.current || drawingRef.current.length < 2) {
      drawingRef.current = null;
      redraw();
      return;
    }
    const newStroke: BaseStroke = {
      id: `base-${Date.now()}`,
      points: drawingRef.current,
      thickness,
      height,
    };
    drawingRef.current = null;
    onChange([...strokes, newStroke]);
  };

  const handleClear = () => onChange([]);
  const handleUndo = () => onChange(strokes.slice(0, -1));

  const content = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={strokes.length === 0}>
          <Undo className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={strokes.length === 0}>
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <Minimize2 className="w-3 h-3 mr-1" /> : <Maximize2 className="w-3 h-3 mr-1" />}
          {expanded ? 'Shrink' : 'Expand'}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Thickness {thickness.toFixed(1)} mm</Label>
          <Slider value={[thickness]} min={0.6} max={6} step={0.2}
            onValueChange={(v) => setThickness(v[0])} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Height {height.toFixed(1)} mm</Label>
          <Slider value={[height]} min={0.4} max={6} step={0.2}
            onValueChange={(v) => setHeight(v[0])} />
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          width={px}
          height={px}
          className="w-full rounded-md border border-border touch-none"
          style={{ aspectRatio: '1 / 1' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="text-[10px] text-muted-foreground">
        Top-down view of the base. Strokes appear as raised ribs on the bottom face.
      </div>
    </div>
  );

  if (expanded) {
    return (
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-3xl">{content}</DialogContent>
      </Dialog>
    );
  }
  return content;
};

export default BaseCanvas;
