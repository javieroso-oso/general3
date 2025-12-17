import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  constrained?: boolean;
}

const ParameterSlider = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  constrained = false,
}: ParameterSliderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <label className={cn(
          "text-sm font-medium",
          constrained ? "text-amber-600" : "text-text-secondary"
        )}>
          {label}
          {constrained && <span className="ml-1 text-xs">(limited)</span>}
        </label>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([val]) => onChange(val)}
        className={cn("cursor-pointer", constrained && "opacity-80")}
      />
    </motion.div>
  );
};

export default ParameterSlider;
