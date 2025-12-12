import { StandParams, StandType } from '@/types/parametric';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ParameterSlider from './ParameterSlider';
import { Footprints, Cable, Grip } from 'lucide-react';

interface StandControlsProps {
  params: StandParams;
  objectBaseRadius: number;
  onChange: (params: StandParams) => void;
}

const StandControls = ({ params, objectBaseRadius, onChange }: StandControlsProps) => {
  const handleChange = <K extends keyof StandParams>(key: K, value: StandParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  // Auto-calculate rim diameter from object
  const calculatedRim = Math.round(objectBaseRadius * 2);

  return (
    <div className="space-y-6">
      {/* Enable Stand Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Add Stand</Label>
          <p className="text-xs text-muted-foreground">
            Generate a printable stand for your object
          </p>
        </div>
        <Switch
          checked={params.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {params.enabled && (
        <>
          {/* Stand Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Stand Type</Label>
            <Select
              value={params.type}
              onValueChange={(value: StandType) => handleChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tripod">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4" />
                    <span>Tripod Stand</span>
                  </div>
                </SelectItem>
                <SelectItem value="pendant">
                  <div className="flex items-center gap-2">
                    <Cable className="w-4 h-4" />
                    <span>Pendant Bracket</span>
                  </div>
                </SelectItem>
                <SelectItem value="wall_arm">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span>Wall Arm</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rim Diameter (display only) */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rim Diameter</span>
              <span className="text-sm font-mono">{calculatedRim}mm</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-calculated from object base diameter
            </p>
          </div>

          {/* Stand Height */}
          <ParameterSlider
            label="Stand Height"
            value={params.height}
            min={50}
            max={300}
            step={5}
            unit="mm"
            onChange={(v) => handleChange('height', v)}
          />

          {/* Tripod-specific */}
          {params.type === 'tripod' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Legs</Label>
                <Select
                  value={String(params.legCount)}
                  onValueChange={(value) => handleChange('legCount', Number(value) as 3 | 4)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Legs</SelectItem>
                    <SelectItem value="4">4 Legs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Spread"
                value={params.legSpread}
                min={20}
                max={60}
                step={1}
                unit="°"
                onChange={(v) => handleChange('legSpread', v)}
              />
            </>
          )}

          {/* Pendant-specific */}
          {params.type === 'pendant' && (
            <ParameterSlider
              label="Cord Length (visual)"
              value={params.cordLength}
              min={100}
              max={1000}
              step={50}
              unit="mm"
              onChange={(v) => handleChange('cordLength', v)}
            />
          )}

          {/* Wall arm-specific */}
          {params.type === 'wall_arm' && (
            <>
              <ParameterSlider
                label="Arm Length"
                value={params.armLength}
                min={100}
                max={400}
                step={10}
                unit="mm"
                onChange={(v) => handleChange('armLength', v)}
              />
              <ParameterSlider
                label="Arm Angle"
                value={params.armAngle}
                min={0}
                max={45}
                step={1}
                unit="°"
                onChange={(v) => handleChange('armAngle', v)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default StandControls;
