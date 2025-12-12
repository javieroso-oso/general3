import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  StandParams,
  StandType,
  TripodStandParams,
  PendantCordParams,
  WallArmParams,
  StandardRimSize,
  getDefaultStandParams,
} from '@/types/lamp';
import { Triangle, Cable, Lamp } from 'lucide-react';

interface StandControlsProps {
  params: StandParams;
  onParamsChange: (params: StandParams) => void;
}

const standTypeOptions: { value: StandType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'tripod', 
    label: 'Tripod', 
    icon: <Triangle className="w-5 h-5" />,
    description: 'Table/floor lamp with legs'
  },
  { 
    value: 'pendant_cord', 
    label: 'Pendant', 
    icon: <Cable className="w-5 h-5" />,
    description: 'Ceiling-hung lamp'
  },
  { 
    value: 'wall_arm', 
    label: 'Wall Arm', 
    icon: <Lamp className="w-5 h-5" />,
    description: 'Wall-mounted sconce'
  },
];

const rimSizeOptions: StandardRimSize[] = [100, 150, 200, 250];

const StandControls = ({ params, onParamsChange }: StandControlsProps) => {
  const updateParam = <K extends keyof StandParams>(key: K, value: StandParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  const handleTypeChange = (newType: StandType) => {
    // When type changes, get fresh defaults for that type
    const newParams = getDefaultStandParams(newType);
    // Preserve rim diameter if compatible
    newParams.rimDiameter = params.rimDiameter;
    newParams.socketType = params.socketType;
    onParamsChange(newParams);
  };
  
  return (
    <div className="space-y-6">
      {/* Stand Type Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-bold uppercase tracking-wider">Stand Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {standTypeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                params.type === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex justify-center mb-1 text-primary">
                {opt.icon}
              </div>
              <p className="text-xs font-medium">{opt.label}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {standTypeOptions.find(o => o.value === params.type)?.description}
        </p>
      </div>
      
      {/* Rim Diameter (must match shade) */}
      <div className="space-y-3">
        <Label className="text-xs font-bold uppercase tracking-wider">Rim Diameter</Label>
        <RadioGroup
          value={params.rimDiameter.toString()}
          onValueChange={(v) => updateParam('rimDiameter', parseInt(v) as StandardRimSize)}
          className="flex gap-2"
        >
          {rimSizeOptions.map((size) => (
            <div key={size} className="flex items-center">
              <RadioGroupItem value={size.toString()} id={`stand-rim-${size}`} className="sr-only" />
              <label
                htmlFor={`stand-rim-${size}`}
                className={`px-3 py-2 rounded-lg border-2 cursor-pointer text-sm font-mono transition-all ${
                  params.rimDiameter === size
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {size}mm
              </label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Must match shade rim diameter
        </p>
      </div>
      
      {/* Height */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider">Stand Height</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.height}mm</span>
        </div>
        <Slider
          value={[params.height]}
          onValueChange={([v]) => updateParam('height', v)}
          min={100}
          max={500}
          step={10}
          className="py-2"
        />
      </div>
      
      {/* Wall Thickness */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider">Wall Thickness</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.wallThickness}mm</span>
        </div>
        <Slider
          value={[params.wallThickness]}
          onValueChange={([v]) => updateParam('wallThickness', v)}
          min={2}
          max={6}
          step={0.5}
          className="py-2"
        />
      </div>
      
      {/* Type-specific controls */}
      {params.type === 'tripod' && (
        <TripodControls 
          params={params as TripodStandParams} 
          onParamsChange={onParamsChange as (p: TripodStandParams) => void} 
        />
      )}
      
      {params.type === 'pendant_cord' && (
        <PendantControls 
          params={params as PendantCordParams} 
          onParamsChange={onParamsChange as (p: PendantCordParams) => void} 
        />
      )}
      
      {params.type === 'wall_arm' && (
        <WallArmControls 
          params={params as WallArmParams} 
          onParamsChange={onParamsChange as (p: WallArmParams) => void} 
        />
      )}
    </div>
  );
};

// Tripod-specific controls
const TripodControls = ({ 
  params, 
  onParamsChange 
}: { 
  params: TripodStandParams; 
  onParamsChange: (p: TripodStandParams) => void;
}) => {
  const update = <K extends keyof TripodStandParams>(key: K, value: TripodStandParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <Label className="text-xs font-bold uppercase tracking-wider text-primary">Tripod Options</Label>
      
      {/* Leg Count */}
      <div className="space-y-2">
        <Label className="text-xs">Number of Legs</Label>
        <div className="flex gap-2">
          {([3, 4] as const).map((count) => (
            <button
              key={count}
              onClick={() => update('legCount', count)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                params.legCount === count
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {count} Legs
            </button>
          ))}
        </div>
      </div>
      
      {/* Leg Spread */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Leg Spread</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.legSpread}°</span>
        </div>
        <Slider
          value={[params.legSpread]}
          onValueChange={([v]) => update('legSpread', v)}
          min={20}
          max={50}
          step={1}
          className="py-2"
        />
      </div>
      
      {/* Leg Thickness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Leg Thickness</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.legThickness}mm</span>
        </div>
        <Slider
          value={[params.legThickness]}
          onValueChange={([v]) => update('legThickness', v)}
          min={5}
          max={15}
          step={1}
          className="py-2"
        />
      </div>
    </div>
  );
};

// Pendant-specific controls
const PendantControls = ({ 
  params, 
  onParamsChange 
}: { 
  params: PendantCordParams; 
  onParamsChange: (p: PendantCordParams) => void;
}) => {
  const update = <K extends keyof PendantCordParams>(key: K, value: PendantCordParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <Label className="text-xs font-bold uppercase tracking-wider text-primary">Pendant Options</Label>
      
      {/* Canopy Diameter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Canopy Diameter</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.canopyDiameter}mm</span>
        </div>
        <Slider
          value={[params.canopyDiameter]}
          onValueChange={([v]) => update('canopyDiameter', v)}
          min={60}
          max={150}
          step={5}
          className="py-2"
        />
      </div>
      
      {/* Canopy Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Canopy Height</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.canopyHeight}mm</span>
        </div>
        <Slider
          value={[params.canopyHeight]}
          onValueChange={([v]) => update('canopyHeight', v)}
          min={15}
          max={50}
          step={5}
          className="py-2"
        />
      </div>
    </div>
  );
};

// Wall arm-specific controls
const WallArmControls = ({ 
  params, 
  onParamsChange 
}: { 
  params: WallArmParams; 
  onParamsChange: (p: WallArmParams) => void;
}) => {
  const update = <K extends keyof WallArmParams>(key: K, value: WallArmParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <Label className="text-xs font-bold uppercase tracking-wider text-primary">Wall Arm Options</Label>
      
      {/* Arm Length */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Arm Length</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.armLength}mm</span>
        </div>
        <Slider
          value={[params.armLength]}
          onValueChange={([v]) => update('armLength', v)}
          min={80}
          max={300}
          step={10}
          className="py-2"
        />
      </div>
      
      {/* Arm Angle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Arm Angle</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.armAngle}°</span>
        </div>
        <Slider
          value={[params.armAngle]}
          onValueChange={([v]) => update('armAngle', v)}
          min={0}
          max={45}
          step={5}
          className="py-2"
        />
      </div>
      
      {/* Backplate Width */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Backplate Width</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.backplateWidth}mm</span>
        </div>
        <Slider
          value={[params.backplateWidth]}
          onValueChange={([v]) => update('backplateWidth', v)}
          min={60}
          max={150}
          step={10}
          className="py-2"
        />
      </div>
    </div>
  );
};

export default StandControls;
