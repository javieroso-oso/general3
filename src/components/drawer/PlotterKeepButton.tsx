import { useState, useRef, useCallback } from 'react';
import { Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlotterParams, PlotterDrawing } from '@/types/plotter';
import { toast } from 'sonner';

interface PlotterKeepButtonProps {
  plotterParams: PlotterParams;
  drawing: PlotterDrawing | null;
  onKeep: (plotterParams: PlotterParams, drawing: PlotterDrawing, thumbnail: string) => void;
}

/**
 * Capture a thumbnail from a PlotterDrawing by rendering it to a canvas
 */
function capturePlotterThumbnail(drawing: PlotterDrawing, size: number = 150): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  // Scale and center the drawing
  const { width, height, paths } = drawing;
  const scale = Math.min((size - 10) / width, (size - 10) / height);
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;
  
  // Draw paths
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for (const path of paths) {
    if (path.points.length < 2) continue;
    
    ctx.beginPath();
    ctx.moveTo(
      path.points[0].x * scale + offsetX,
      path.points[0].y * scale + offsetY
    );
    
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(
        path.points[i].x * scale + offsetX,
        path.points[i].y * scale + offsetY
      );
    }
    
    ctx.stroke();
  }
  
  return canvas.toDataURL('image/jpeg', 0.8);
}

const PlotterKeepButton = ({ plotterParams, drawing, onKeep }: PlotterKeepButtonProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [justKept, setJustKept] = useState(false);

  const handleKeep = useCallback(async () => {
    if (isCapturing || !drawing) return;
    
    setIsCapturing(true);
    try {
      const thumbnail = capturePlotterThumbnail(drawing);
      onKeep(plotterParams, drawing, thumbnail);
      
      setJustKept(true);
      toast.success('Added to drawer');
      
      // Reset the "just kept" state after animation
      setTimeout(() => setJustKept(false), 1500);
    } catch (error) {
      console.error('Failed to capture thumbnail:', error);
      toast.error('Could not capture design');
    } finally {
      setIsCapturing(false);
    }
  }, [plotterParams, drawing, onKeep, isCapturing]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleKeep}
      disabled={isCapturing || !drawing}
      className="gap-1.5 h-8"
    >
      {justKept ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {isCapturing ? 'Capturing...' : justKept ? 'Kept!' : 'Keep'}
    </Button>
  );
};

export default PlotterKeepButton;
