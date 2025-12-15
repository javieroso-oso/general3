import { 
  ParametricStandParams, 
  StandMountType,
  LegProfile,
  RimSize,
  rimSizes,
} from '@/types/stand';
import { ObjectType } from '@/types/parametric';
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
  Cylinder,
  Square,
} from 'lucide-react';

interface ParametricStandControlsProps {
  params: ParametricStandParams;
  objectRimSize: RimSize;
  objectType: ObjectType;
  onChange: (params: ParametricStandParams) => void;
}

const ParametricStandControls = ({ 
  params, 
  objectRimSize,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const sizesMatch = params.socketSize === objectRimSize;
  
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
            Object's collar sits into stand's socket cradle
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
            <Label className="text-sm font-medium">Stand Type</Label>
            <Select
              value={params.mountType}
              onValueChange={(value: StandMountType) => handleChange('mountType', value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="tripod">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4" />
                    <span>Tripod (WOOJ-style)</span>
                  </div>
                </SelectItem>
                <SelectItem value="ribbed_pedestal">
                  <div className="flex items-center gap-2">
                    <Cylinder className="w-4 h-4" />
                    <span>Ribbed Pedestal</span>
                  </div>
                </SelectItem>
                <SelectItem value="pendant">
                  <div className="flex items-center gap-2">
                    <Cable className="w-4 h-4" />
                    <span>Pendant</span>
                  </div>
                </SelectItem>
                <SelectItem value="wall_plate">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span>Wall Plate + Arm</span>
                  </div>
                </SelectItem>
                <SelectItem value="flat_back">
                  <div className="flex items-center gap-2">
                    <Square className="w-4 h-4" />
                    <span>Flat Back (wall mount)</span>
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
                {sizesMatch ? 'Connection Matched' : 'Size Mismatch'}
              </span>
              <p className="text-xs text-muted-foreground">
                Socket: {params.socketSize}mm • Object collar: {objectRimSize}mm
              </p>
            </div>
          </div>

          {/* Socket Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Socket Cradle Size</Label>
            <Select
              value={String(params.socketSize)}
              onValueChange={(value) => handleChange('socketSize', Number(value) as RimSize)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {rimSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}mm {size === objectRimSize && '✓ matches'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Socket Cradle Depth */}
          <ParameterSlider
            label="Cradle Depth"
            value={params.socketCradleDepth}
            min={3}
            max={10}
            step={0.5}
            unit="mm"
            onChange={(v) => handleChange('socketCradleDepth', v)}
          />
          
          {/* Stand Height */}
          <ParameterSlider
            label="Stand Height"
            value={params.height}
            min={50}
            max={250}
            step={5}
            unit="mm"
            onChange={(v) => handleChange('height', v)}
          />

          {/* Tripod-specific controls */}
          {params.mountType === 'tripod' && (
            <>
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tripod Settings</Label>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Legs</Label>
                <Select
                  value={String(params.legCount)}
                  onValueChange={(value) => handleChange('legCount', Number(value) as 3 | 4)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="3">3 Legs</SelectItem>
                    <SelectItem value="4">4 Legs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Spread"
                value={params.legSpread}
                min={20}
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
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="angular">Hexagonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Thickness"
                value={params.legThickness}
                min={3}
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

          {/* Ribbed pedestal controls */}
          {params.mountType === 'ribbed_pedestal' && (
            <>
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pedestal Settings</Label>
              </div>
              
              <ParameterSlider
                label="Pedestal Diameter"
                value={params.pedestalDiameter}
                min={50}
                max={150}
                step={5}
                unit="mm"
                onChange={(v) => handleChange('pedestalDiameter', v)}
              />

              <ParameterSlider
                label="Rib Count"
                value={params.ribCount}
                min={12}
                max={32}
                step={2}
                onChange={(v) => handleChange('ribCount', v)}
              />

              <ParameterSlider
                label="Rib Depth"
                value={params.ribDepth}
                min={1}
                max={5}
                step={0.5}
                unit="mm"
                onChange={(v) => handleChange('ribDepth', v)}
              />

              <ParameterSlider
                label="Base Flare"
                value={params.baseFlare}
                min={0}
                max={0.5}
                step={0.05}
                onChange={(v) => handleChange('baseFlare', v)}
              />
            </>
          )}

          {/* Pendant controls */}
          {params.mountType === 'pendant' && (
            <>
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pendant Settings</Label>
              </div>
              
              <ParameterSlider
                label="Cord Length"
                value={params.cordLength}
                min={100}
                max={1000}
                step={50}
                unit="mm"
                onChange={(v) => handleChange('cordLength', v)}
              />

              <ParameterSlider
                label="Canopy Diameter"
                value={params.canopyDiameter}
                min={60}
                max={120}
                step={10}
                unit="mm"
                onChange={(v) => handleChange('canopyDiameter', v)}
              />
            </>
          )}

          {/* Wall plate controls */}
          {params.mountType === 'wall_plate' && (
            <>
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Wall Mount Settings</Label>
              </div>
              
              <ParameterSlider
                label="Plate Width"
                value={params.plateWidth}
                min={60}
                max={150}
                step={10}
                unit="mm"
                onChange={(v) => handleChange('plateWidth', v)}
              />

              <ParameterSlider
                label="Plate Height"
                value={params.plateHeight}
                min={60}
                max={150}
                step={10}
                unit="mm"
                onChange={(v) => handleChange('plateHeight', v)}
              />

              <ParameterSlider
                label="Arm Length"
                value={params.armLength}
                min={100}
                max={300}
                step={10}
                unit="mm"
                onChange={(v) => handleChange('armLength', v)}
              />

              <ParameterSlider
                label="Arm Angle"
                value={params.armAngle}
                min={-30}
                max={30}
                step={5}
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
