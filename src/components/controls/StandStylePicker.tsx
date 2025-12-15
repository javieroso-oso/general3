import { StandStyle, standStylePresets } from '@/types/stand';
import { cn } from '@/lib/utils';
import { 
  Minus, 
  Square, 
  Triangle, 
  Circle, 
  Hexagon,
  Sparkles,
  Footprints,
  Columns
} from 'lucide-react';

interface StandStylePickerProps {
  value: StandStyle;
  onChange: (style: StandStyle) => void;
}

const styleIcons: Record<StandStyle, React.ReactNode> = {
  minimalist: <Minus className="w-5 h-5" />,
  industrial: <Square className="w-5 h-5" />,
  art_deco: <Triangle className="w-5 h-5" />,
  organic: <Circle className="w-5 h-5" />,
  retro: <Sparkles className="w-5 h-5" />,
  brutalist: <Hexagon className="w-5 h-5" />,
  wooj_splayed: <Footprints className="w-5 h-5" />,
  ribbed_pedestal: <Columns className="w-5 h-5" />,
  floating_ring: <Circle className="w-5 h-5" />,
};

const StandStylePicker = ({ value, onChange }: StandStylePickerProps) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {standStylePresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange(preset.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
              "hover:border-primary/50 hover:bg-primary/5",
              value === preset.id
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-background"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              value === preset.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {styleIcons[preset.id]}
            </div>
            <span className={cn(
              "text-xs font-medium",
              value === preset.id ? "text-primary" : "text-foreground"
            )}>
              {preset.name}
            </span>
          </button>
        ))}
      </div>
      
      {/* Description */}
      <p className="text-xs text-muted-foreground text-center px-2">
        {standStylePresets.find(p => p.id === value)?.description}
      </p>
    </div>
  );
};

export default StandStylePicker;
