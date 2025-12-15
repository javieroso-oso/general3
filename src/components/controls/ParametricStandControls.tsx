import { 
  ParametricStandParams, 
  StandMountType,
  LegProfile,
  PlugSize,
  plugSizes,
} from '@/types/stand';
import { SocketSize, ObjectType } from '@/types/parametric';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ParameterSlider from './ParameterSlider';
import { Badge } from '@/components/ui/badge';
import { 
  Footprints, 
  Cable, 
  Grip, 
  CheckCircle2,
} from 'lucide-react';

interface ParametricStandControlsProps {
  params: ParametricStandParams;
  objectSocketSize: SocketSize;
  objectType: ObjectType;
  onChange: (params: ParametricStandParams) => void;
}

const ParametricStandControls = ({ 
  params, 
  objectSocketSize,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const sizesMatch = params.plugSize === objectSocketSize;
  
  const handleChange = <K extends keyof ParametricStandParams>(
    key: K, 
    value: ParametricStandParams[K]
  ) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Enable Stand Toggle */}
      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Add Stand</Label>
          <p className="text-xs text-muted-foreground">
            Plug fits inside object's socket
          </p>
        </div>
        <Switch
          checked={params.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {params.enabled && (
        <>
          {/* Mount Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mount Type</Label>
            <Select
              value={params.mountType}
              onValueChange={(value: StandMountType) => handleChange('mountType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tripod">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4" />
                    <span>Tripod</span>
                  </div>
                </SelectItem>
                <SelectItem value="pendant">
                  <div className="flex items-center gap-2">
                    <Cable className="w-4 h-4" />
                    <span>Pendant</span>
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

          {/* Connection status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
            sizesMatch 
              ? 'bg-primary/10 border-primary/20' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
          }`}>
            <CheckCircle2 className={`w-4 h-4 ${sizesMatch ? 'text-primary' : 'text-amber-600'}`} />
            <div className="flex-1">
              <span className="text-sm font-medium">
                {sizesMatch ? 'Sizes Match' : 'Size Mismatch'}
              </span>
              <p className="text-xs text-muted-foreground">
                Plug: {params.plugSize}mm • Socket: {objectSocketSize}mm
              </p>
            </div>
          </div>

          {/* Plug Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Connection Size</Label>
            <Select
              value={String(params.plugSize)}
              onValueChange={(value) => handleChange('plugSize', Number(value) as PlugSize)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plugSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}mm {size === objectSocketSize && '✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plug Height */}
          <ParameterSlider
            label="Plug Height"
            value={params.plugHeight}
            min={15}
            max={30}
            step={1}
            unit="mm"
            onChange={(v) => handleChange('plugHeight', v)}
          />
          
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

          {/* Tripod-specific controls */}
          {params.mountType === 'tripod' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Legs</Label>
                <Select
                  value={String(params.legCount)}
                  onValueChange={(value) => handleChange('legCount', Number(value) as 3 | 4 | 5 | 6)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Legs</SelectItem>
                    <SelectItem value="4">4 Legs</SelectItem>
                    <SelectItem value="5">5 Legs</SelectItem>
                    <SelectItem value="6">6 Legs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Spread"
                value={params.legSpread}
                min={15}
                max={45}
                step={1}
                unit="°"
                onChange={(v) => handleChange('legSpread', v)}
              />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Leg Profile</Label>
                <Select
                  value={params.legProfile}
                  onValueChange={(value: LegProfile) => handleChange('legProfile', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="angular">Hexagonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Thickness"
                value={params.legThickness}
                min={2}
                max={10}
                step={0.5}
                unit="mm"
                onChange={(v) => handleChange('legThickness', v)}
              />

              <ParameterSlider
                label="Leg Taper"
                value={params.legTaper}
                min={0}
                max={0.8}
                step={0.05}
                onChange={(v) => handleChange('legTaper', v)}
              />
            </>
          )}

          {/* Pendant controls */}
          {params.mountType === 'pendant' && (
            <ParameterSlider
              label="Cord Length"
              value={params.cordLength}
              min={100}
              max={1000}
              step={50}
              unit="mm"
              onChange={(v) => handleChange('cordLength', v)}
            />
          )}

          {/* Wall arm controls */}
          {params.mountType === 'wall_arm' && (
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

export default ParametricStandControls;
