import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

const ParameterSlider = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: ParameterSliderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">
          {label}
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
        className="cursor-pointer"
      />
    </motion.div>
  );
};

export default ParameterSlider;
