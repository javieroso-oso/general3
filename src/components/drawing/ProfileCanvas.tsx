import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Path, Line, Circle, PencilBrush } from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Pen, Pencil, Eraser, Trash2, Undo, Redo } from 'lucide-react';
import { ProfilePoint } from '@/types/custom-profile';

interface ProfileCanvasProps {
  onProfileChange: (points: ProfilePoint[]) => void;
  width?: number;
  height?: number;
}

// Fixed colors - Fabric.js doesn't support CSS variables
const COLORS = {
  background: '#f4f4f5',
  grid: '#e4e4e7',
  axis: '#3b82f6',
  stroke: '#18181b',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  eraser: '#f4f4f5',
};

const ProfileCanvas = ({ onProfileChange, width = 400, height = 500 }: ProfileCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'pen' | 'brush' | 'eraser' | 'select'>('pen');
  const [brushWidth, setBrushWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isLoadingFromHistory = useRef(false);

  const axisX = width / 3;
  const scale = 2;

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: COLORS.background,
      selection: false,
    });

    // Draw axis line
    const axisLine = new Line([axisX, 0, axisX, height], {
      stroke: COLORS.axis,
      strokeWidth: 2,
      selectable: false,
      evented: false,
      strokeDashArray: [5, 5],
    });
    canvas.add(axisLine);

    // Draw grid
    const gridSpacing = 20;
    for (let x = 0; x < width; x += gridSpacing) {
      if (x !== axisX) {
        const line = new Line([x, 0, x, height], {
          stroke: COLORS.grid,
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
        });
        canvas.add(line);
      }
    }
    for (let y = 0; y < height; y += gridSpacing) {
      const line = new Line([0, y, width, y], {
        stroke: COLORS.grid,
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
      });
      canvas.add(line);
    }

    // Initialize brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = COLORS.stroke;
    canvas.freeDrawingBrush.width = brushWidth;

    setFabricCanvas(canvas);

    // Save initial state to history
    const initialState = JSON.stringify(canvas.toJSON());
    setHistory([initialState]);
    setHistoryIndex(0);

    return () => {
      canvas.dispose();
    };
  }, [width, height, axisX]);

  // Update brush settings
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === 'brush' || activeTool === 'eraser';
    
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.width = brushWidth;
      fabricCanvas.freeDrawingBrush.color = activeTool === 'eraser' 
        ? COLORS.eraser 
        : COLORS.stroke;
    }
  }, [activeTool, brushWidth, fabricCanvas]);

  // Extract profile from canvas
  const extractProfile = useCallback(() => {
    if (!fabricCanvas) return;

    const points: ProfilePoint[] = [];
    const objects = fabricCanvas.getObjects();

    objects.forEach(obj => {
      if (obj instanceof Path) {
        const pathData = obj.path;
        if (!pathData) return;

        pathData.forEach((cmd: any) => {
          if (cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Q') {
            const x = cmd[cmd.length - 2];
            const y = cmd[cmd.length - 1];
            
            if (x > axisX) {
              points.push({
                x: (x - axisX) / scale,
                y: (height - y) / scale,
              });
            }
          }
        });
      } else if (obj instanceof Circle) {
        const left = obj.left || 0;
        const top = obj.top || 0;
        if (left > axisX) {
          points.push({
            x: (left - axisX) / scale,
            y: (height - top) / scale,
          });
        }
      }
    });

    // Keep points in drawing order (no sorting) - important for Extrude Direct mode

    // Remove duplicates and very close points
    const filteredPoints: ProfilePoint[] = [];
    points.forEach(p => {
      const lastPoint = filteredPoints[filteredPoints.length - 1];
      if (!lastPoint || Math.abs(p.y - lastPoint.y) > 0.5 || Math.abs(p.x - lastPoint.x) > 0.5) {
        filteredPoints.push(p);
      }
    });

    onProfileChange(filteredPoints);
  }, [fabricCanvas, axisX, height, scale, onProfileChange]);

  // Listen for canvas changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleChange = () => {
      if (isLoadingFromHistory.current) return;
      
      extractProfile();
      
      // Save to history
      const json = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    };

    fabricCanvas.on('path:created', handleChange);
    fabricCanvas.on('object:modified', handleChange);

    return () => {
      fabricCanvas.off('path:created', handleChange);
      fabricCanvas.off('object:modified', handleChange);
    };
  }, [fabricCanvas, extractProfile, historyIndex]);

  // Add point on click in pen mode
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleClick = (e: any) => {
      if (activeTool !== 'pen') return;
      
      const pointer = fabricCanvas.getPointer(e.e);
      if (pointer.x <= axisX) return;

      const circle = new Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 6,
        fill: COLORS.primary,
        stroke: COLORS.primaryForeground,
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: true,
        hasControls: false,
      });

      fabricCanvas.add(circle);
      
      // Manually trigger history save after adding point
      extractProfile();
      const json = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    };

    fabricCanvas.on('mouse:down', handleClick);
    return () => {
      fabricCanvas.off('mouse:down', handleClick);
    };
  }, [fabricCanvas, activeTool, axisX, extractProfile, historyIndex]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects().filter(obj => 
      obj.selectable !== false
    );
    objects.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.renderAll();
    onProfileChange([]);
    
    // Save cleared state to history
    const json = JSON.stringify(fabricCanvas.toJSON());
    setHistory(prev => [...prev.slice(0, historyIndex + 1), json]);
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex <= 0 || !fabricCanvas) return;
    
    const newIndex = historyIndex - 1;
    const historyState = history[newIndex];
    
    if (!historyState) return;
    
    try {
      isLoadingFromHistory.current = true;
      fabricCanvas.loadFromJSON(JSON.parse(historyState), () => {
        fabricCanvas.renderAll();
        setHistoryIndex(newIndex);
        extractProfile();
        isLoadingFromHistory.current = false;
      });
    } catch (error) {
      console.error('Error loading history:', error);
      isLoadingFromHistory.current = false;
    }
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1 || !fabricCanvas) return;
    
    const newIndex = historyIndex + 1;
    const historyState = history[newIndex];
    
    if (!historyState) return;
    
    try {
      isLoadingFromHistory.current = true;
      fabricCanvas.loadFromJSON(JSON.parse(historyState), () => {
        fabricCanvas.renderAll();
        setHistoryIndex(newIndex);
        extractProfile();
        isLoadingFromHistory.current = false;
      });
    } catch (error) {
      console.error('Error loading history:', error);
      isLoadingFromHistory.current = false;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeTool === 'pen' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTool('pen')}
        >
          <Pen className="w-4 h-4 mr-1" />
          Point
        </Button>
        <Button
          variant={activeTool === 'brush' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTool('brush')}
        >
          <Pencil className="w-4 h-4 mr-1" />
          Draw
        </Button>
        <Button
          variant={activeTool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTool('eraser')}
        >
          <Eraser className="w-4 h-4 mr-1" />
          Erase
        </Button>
        
        <div className="h-6 w-px bg-border mx-2" />
        
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex <= 0}>
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
          <Redo className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Brush size */}
      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <div className="flex items-center gap-4">
          <Label className="text-sm text-muted-foreground">Brush Size</Label>
          <Slider
            value={[brushWidth]}
            onValueChange={([v]) => setBrushWidth(v)}
            min={1}
            max={20}
            step={1}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">{brushWidth}px</span>
        </div>
      )}

      {/* Canvas */}
      <div className="border border-border rounded-lg overflow-hidden bg-muted">
        <canvas ref={canvasRef} />
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground">
        Draw your profile to the right of the blue dashed axis line. The shape will be transformed based on the selected generation mode.
      </p>
    </div>
  );
};

export default ProfileCanvas;