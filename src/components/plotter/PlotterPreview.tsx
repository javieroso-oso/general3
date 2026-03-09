import { useMemo } from 'react';
import { PlotterDrawing, PlotterPreviewColors, defaultPreviewColors } from '@/types/plotter';
import { calculateStats } from '@/lib/plotter/path-utils';

interface PlotterPreviewProps {
  drawing: PlotterDrawing | null;
  showBounds?: boolean;
  showStats?: boolean;
  margin?: number;
  previewColors?: PlotterPreviewColors;
}

const PlotterPreview = ({ 
  drawing, 
  showBounds = true, 
  showStats = true,
  margin = 10,
  previewColors = defaultPreviewColors,
}: PlotterPreviewProps) => {
  const stats = useMemo(() => {
    if (!drawing) return null;
    return calculateStats(drawing);
  }, [drawing]);

  if (!drawing) {
    return (
      <div className="flex items-center justify-center h-full bg-secondary/20 rounded-lg">
        <p className="text-sm text-muted-foreground">No drawing generated</p>
      </div>
    );
  }

  const { width, height, paths } = drawing;
  
  // Calculate SVG viewBox with padding
  const padding = 5;
  const viewBox = `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;

  // Build path elements
  const pathElements = paths.map((path, index) => {
    if (path.points.length < 2) return null;
    
    const d = path.points.map((pt, i) => {
      const command = i === 0 ? 'M' : 'L';
      return `${command}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    }).join(' ');
    
    // Determine stroke color: multi-pen by layer, path color, or global stroke
    let strokeColor: string;
    if (previewColors.multiPen && previewColors.penColors.length > 0) {
      const layerIndex = path.layer ?? index;
      strokeColor = previewColors.penColors[layerIndex % previewColors.penColors.length];
    } else {
      strokeColor = path.color || previewColors.strokeColor;
    }
    
    return (
      <path
        key={index}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={previewColors.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-opacity"
      />
    );
  });

  return (
    <div className="relative h-full flex flex-col">
      {/* SVG Preview */}
      <div className="flex-1 flex items-center justify-center p-4 bg-card/50 rounded-lg overflow-hidden">
        <svg
          viewBox={viewBox}
          className="max-w-full max-h-full"
          style={{ 
            aspectRatio: `${width} / ${height}`,
          }}
        >
          {/* Paper background */}
          <rect
            x={-padding}
            y={-padding}
            width={width + padding * 2}
            height={height + padding * 2}
            fill={previewColors.backgroundColor}
          />

          {/* Paper bounds */}
          {showBounds && (
            <>
              {/* Paper outline */}
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
                strokeDasharray="2,2"
              />
              {/* Margin area */}
              <rect
                x={margin}
                y={margin}
                width={width - margin * 2}
                height={height - margin * 2}
                fill="none"
                stroke="hsl(var(--muted-foreground) / 0.3)"
                strokeWidth={0.25}
                strokeDasharray="1,1"
              />
            </>
          )}
          
          {/* Drawing paths */}
          <g id="plotter-paths">
            {pathElements}
          </g>
        </svg>
      </div>

      {/* Stats bar */}
      {showStats && stats && (
        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 rounded-lg mt-2 text-xs">
          <div className="flex gap-4">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{stats.pathCount}</span> paths
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{(stats.totalPathLength / 1000).toFixed(1)}m</span> draw
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{(stats.totalTravelDistance / 1000).toFixed(1)}m</span> travel
            </span>
          </div>
          <span className="text-primary font-medium">
            ~{stats.estimatedTimeMinutes} min
          </span>
        </div>
      )}
    </div>
  );
};

export default PlotterPreview;
