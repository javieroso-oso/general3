import * as React from "react";
import { cn } from "@/lib/utils";

interface DialProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const Dial = React.forwardRef<HTMLDivElement, DialProps>(
  ({ value, min, max, step = 1, onChange, label, unit, size = "md", disabled, className }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [startY, setStartY] = React.useState(0);
    const [startValue, setStartValue] = React.useState(value);
    const dialRef = React.useRef<HTMLDivElement>(null);

    const sizeClasses = {
      sm: "w-12 h-12",
      md: "w-16 h-16",
      lg: "w-20 h-20",
    };

    const valueFontSize = {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    };

    // Map value to rotation angle (0° at min, 270° at max)
    const percentage = (value - min) / (max - min);
    const rotation = percentage * 270 - 135; // Start from -135° (7 o'clock) to 135° (5 o'clock)

    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
      setStartY(e.clientY);
      setStartValue(value);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled) return;
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
      setStartValue(value);
    };

    React.useEffect(() => {
      if (!isDragging) return;

      const handleMove = (clientY: number) => {
        const delta = startY - clientY;
        const sensitivity = 0.5;
        const range = max - min;
        const valueChange = (delta * sensitivity * range) / 100;
        
        let newValue = startValue + valueChange;
        newValue = Math.max(min, Math.min(max, newValue));
        
        // Snap to step
        newValue = Math.round(newValue / step) * step;
        
        if (newValue !== value) {
          onChange(newValue);
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        handleMove(e.clientY);
      };

      const handleTouchMove = (e: TouchEvent) => {
        handleMove(e.touches[0].clientY);
      };

      const handleEnd = () => {
        setIsDragging(false);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleEnd);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleEnd);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleEnd);
      };
    }, [isDragging, startY, startValue, min, max, step, value, onChange]);

    // Double-click to reset or enter exact value
    const handleDoubleClick = () => {
      if (disabled) return;
      const input = window.prompt(`Enter value (${min}-${max}):`, String(value));
      if (input !== null) {
        const parsed = parseFloat(input);
        if (!isNaN(parsed)) {
          const clamped = Math.max(min, Math.min(max, parsed));
          const stepped = Math.round(clamped / step) * step;
          onChange(stepped);
        }
      }
    };

    const formatValue = (v: number) => {
      if (step >= 1) return Math.round(v);
      if (step >= 0.1) return v.toFixed(1);
      return v.toFixed(2);
    };

    return (
      <div
        ref={ref}
        className={cn("dial-container select-none", className)}
      >
        <div
          ref={dialRef}
          className={cn(
            "relative rounded-full cursor-ns-resize transition-all duration-150",
            sizeClasses[size],
            isDragging && "animate-dial-pulse",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            background: `conic-gradient(
              from -135deg,
              hsl(var(--primary) / 0.15) 0deg,
              hsl(var(--primary) / 0.4) ${percentage * 270}deg,
              hsl(var(--secondary)) ${percentage * 270}deg,
              hsl(var(--secondary)) 270deg
            )`,
            boxShadow: isDragging
              ? "inset 0 2px 4px hsla(220, 20%, 20%, 0.1), 0 0 0 3px hsla(var(--primary), 0.15)"
              : "inset 0 2px 4px hsla(220, 20%, 20%, 0.05)",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={handleDoubleClick}
        >
          {/* Inner circle */}
          <div 
            className={cn(
              "absolute inset-1.5 rounded-full bg-card flex items-center justify-center",
              "shadow-sm"
            )}
          >
            {/* Value display */}
            <span className={cn("font-mono font-medium text-foreground", valueFontSize[size])}>
              {formatValue(value)}
              {unit && <span className="text-muted-foreground ml-0.5 text-[0.7em]">{unit}</span>}
            </span>
          </div>

          {/* Indicator dot */}
          <div
            className="absolute w-1.5 h-1.5 bg-primary rounded-full"
            style={{
              top: "6px",
              left: "50%",
              marginLeft: "-3px",
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `50% calc(${size === "sm" ? "18px" : size === "md" ? "26px" : "34px"})`,
            }}
          />
        </div>

        {label && (
          <span className="text-xs text-muted-foreground font-medium text-center">
            {label}
          </span>
        )}
      </div>
    );
  }
);

Dial.displayName = "Dial";

export { Dial };
