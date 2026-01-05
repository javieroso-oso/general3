import { Dial } from "@/components/ui/dial";

interface ParameterDialProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: "sm" | "md" | "lg";
  onChange: (value: number) => void;
  disabled?: boolean;
}

const ParameterDial = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  size = "md",
  onChange,
  disabled,
}: ParameterDialProps) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <Dial
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        size={size}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="text-xs text-muted-foreground font-medium text-center max-w-[80px] truncate">
        {label}
      </span>
    </div>
  );
};

export default ParameterDial;
