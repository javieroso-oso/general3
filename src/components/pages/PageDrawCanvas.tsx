import { useRef, useEffect, useState, useCallback } from 'react';
import { PageDrawingStroke } from '@/types/pages';
import { Button } from '@/components/ui/button';
import { Trash2, Undo } from 'lucide-react';

interface PageDrawCanvasProps {
  strokes: PageDrawingStroke[];
  onChange: (s: PageDrawingStroke[]) => void;
  pageWidthMm: number;
  pageHeightMm: number;
  thicknessMm?: number;
}

const PageDrawCanvas = ({ strokes, onChange, pageWidthMm, pageHeightMm, thicknessMm = 1.5 }: PageDrawCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 280 });
  const [drawing, setDrawing] = useState(false);
  const currentRef = useRef<PageDrawingStroke | null>(null);

  // Compute display size with correct aspect ratio
  useEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      const w = wrapRef.current!.clientWidth;
      const aspect = pageHeightMm / pageWidthMm;
      const h = Math.min(420, Math.round(w * aspect));
      setSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [pageWidthMm, pageHeightMm]);

  // Redraw
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(0.5, 0.5, size.w - 1, size.h - 1);

    const drawStroke = (s: PageDrawingStroke) => {
      const px = (s.thickness * size.w) / pageWidthMm;
      ctx.lineWidth = px;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0066ff';
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.u * size.w;
        const y = p.v * size.h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    strokes.forEach(drawStroke);
    if (currentRef.current) drawStroke(currentRef.current);
  }, [strokes, size, pageWidthMm]);

  const ptFromEvent = (e: React.PointerEvent): { u: number; v: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      u: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      v: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    currentRef.current = { points: [ptFromEvent(e)], thickness: thicknessMm };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing || !currentRef.current) return;
    currentRef.current.points.push(ptFromEvent(e));
    // trigger redraw
    setSize(s => ({ ...s }));
  };
  const onUp = () => {
    if (currentRef.current && currentRef.current.points.length >= 2) {
      onChange([...strokes, currentRef.current]);
    }
    currentRef.current = null;
    setDrawing(false);
  };

  return (
    <div ref={wrapRef} className="space-y-2">
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{ width: size.w, height: size.h, display: 'block', borderRadius: 6, cursor: 'crosshair' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange(strokes.slice(0, -1))} disabled={strokes.length === 0}>
          <Undo className="w-3 h-3 mr-1" /> Undo
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange([])} disabled={strokes.length === 0}>
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
        <span className="text-xs text-muted-foreground self-center">{strokes.length} stroke{strokes.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
};

export default PageDrawCanvas;
