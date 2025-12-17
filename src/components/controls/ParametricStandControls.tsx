import { 
  ConstrainedStandParams,
  StandArchetype,
  BaseSize,
  FootSpread,
  RodThickness,
  ColumnThickness,
  ShadeGeometry,
  getStandProductName,
  calculateStandDimensions,
  defaultShadeGeometry,
} from '@/types/stand';
import { ObjectType } from '@/types/parametric';
import { SocketType, BulbShape } from '@/types/lamp';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ParameterSlider from './ParameterSlider';
import { 
  Cylinder,
  Circle,
  Footprints, 
  Cable,
  Lightbulb,
  ThermometerSun,
  Flame,
  ChevronDown,
  Settings2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

interface ParametricStandControlsProps {
  params: ConstrainedStandParams;
  shadeGeometry?: ShadeGeometry;
  objectType: ObjectType;
  onChange: (params: ConstrainedStandParams) => void;
}

const archetypeIcons: Record<StandArchetype, typeof Cylinder> = {
  column: Cylinder,
  disc_base: Circle,
  tripod: Footprints,
  pendant: Cable,
};

const archetypeDescriptions: Record<StandArchetype, string> = {
  column: 'Minimal vertical column',
  disc_base: 'Graphic disc with thin rod',
  tripod: 'Three identical legs',
  pendant: 'Ceiling-mounted drop',
};

const ParametricStandControls = ({ 
  params, 
  shadeGeometry = defaultShadeGeometry,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  const dims = calculateStandDimensions(shadeGeometry, params);
  const productName = getStandProductName(params.archetype);
  
  const handleChange = <K extends keyof ConstrainedStandParams>(
    key: K, 
    value: ConstrainedStandParams[K]
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
            Auto-sized to match your shade
          </p>
        </div>
        <Switch
          checked={params.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {params.enabled && (
        <>
          {/* Product Name Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {productName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Base: {Math.round(dims.baseDiameter)}mm auto-calculated
            </span>
          </div>

          {/* STEP 1: Stand Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span>
              Choose Stand Type
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(['column', 'disc_base', 'tripod', 'pendant'] as StandArchetype[]).map((type) => {
                const Icon = archetypeIcons[type];
                const isSelected = params.archetype === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleChange('archetype', type)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium capitalize">{type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{archetypeDescriptions[type]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Size Controls */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
              Size
            </Label>
            
            {/* Overall Height - the ONE user-adjustable dimension */}
            <ParameterSlider
              label="Overall Height"
              value={params.overallHeight}
              min={80}
              max={300}
              step={10}
              unit="mm"
              onChange={(v) => handleChange('overallHeight', v)}
            />

            {/* Base Size (discrete) */}
            {params.archetype !== 'pendant' && (
              <div className="space-y-2">
                <Label className="text-sm">Base Size</Label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as BaseSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleChange('baseSize', size)}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm capitalize ${
                        params.baseSize === size
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pendant-specific: Cable Length */}
            {params.archetype === 'pendant' && (
              <ParameterSlider
                label="Cable Length"
                value={params.cableLength}
                min={200}
                max={1500}
                step={50}
                unit="mm"
                onChange={(v) => handleChange('cableLength', v)}
              />
            )}
          </div>

          {/* STEP 3: Advanced (collapsed by default) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-between p-2 rounded-lg hover:bg-secondary/30">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span>Advanced</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              
              {/* Column-specific */}
              {params.archetype === 'column' && (
                <div className="space-y-2">
                  <Label className="text-sm">Column Thickness</Label>
                  <div className="flex gap-2">
                    {(['slim', 'standard', 'bold'] as ColumnThickness[]).map((thickness) => (
                      <button
                        key={thickness}
                        onClick={() => handleChange('columnThickness', thickness)}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm capitalize ${
                          params.columnThickness === thickness
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {thickness}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Disc base-specific */}
              {params.archetype === 'disc_base' && (
                <div className="space-y-2">
                  <Label className="text-sm">Rod Thickness</Label>
                  <div className="flex gap-2">
                    {([8, 10, 12] as RodThickness[]).map((thickness) => (
                      <button
                        key={thickness}
                        onClick={() => handleChange('rodThickness', thickness)}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                          params.rodThickness === thickness
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {thickness}mm
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tripod-specific */}
              {params.archetype === 'tripod' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Foot Spread</Label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'wide'] as FootSpread[]).map((spread) => (
                        <button
                          key={spread}
                          onClick={() => handleChange('footSpread', spread)}
                          className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm capitalize ${
                            params.footSpread === spread
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {spread}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ParameterSlider
                    label="Leg Thickness"
                    value={params.legThickness}
                    min={4}
                    max={8}
                    step={0.5}
                    unit="mm"
                    onChange={(v) => handleChange('legThickness', v)}
                  />
                </>
              )}

              {/* Pendant-specific */}
              {params.archetype === 'pendant' && (
                <div className="space-y-2">
                  <Label className="text-sm">Canopy Size</Label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as BaseSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => handleChange('canopySize', size)}
                        className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm capitalize ${
                          params.canopySize === size
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wire visibility toggle */}
              <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Show Wire Channel</Label>
                </div>
                <Switch
                  checked={params.showWire}
                  onCheckedChange={(checked) => handleChange('showWire', checked)}
                />
              </div>

              {/* Auto-calculated dimensions info */}
              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">Auto-calculated from shade:</p>
                <p>Base Ø: {Math.round(dims.baseDiameter)}mm</p>
                <p>Base Height: {Math.round(dims.baseThickness)}mm</p>
                <p>Connector Ø: {dims.connectorDiameter}mm</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Lamp Hardware Controls (only for lamp type) */}
          {objectType === 'lamp' && (
            <>
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Lamp Hardware</Label>
                </div>
              </div>
              
              {/* Show Hardware Preview Toggle */}
              <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Preview Hardware</Label>
                  <p className="text-xs text-muted-foreground">
                    Show socket, bulb, and heat zones
                  </p>
                </div>
                <Switch
                  checked={params.showHardwarePreview}
                  onCheckedChange={(checked) => handleChange('showHardwarePreview', checked)}
                />
              </div>

              {params.showHardwarePreview && (
                <>
                  {/* Socket Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Socket Type</Label>
                    <Select
                      value={params.socketType}
                      onValueChange={(value: SocketType) => handleChange('socketType', value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="E26">E26 (US Standard)</SelectItem>
                        <SelectItem value="E27">E27 (EU Standard)</SelectItem>
                        <SelectItem value="E12">E12 (Candelabra)</SelectItem>
                        <SelectItem value="GU10">GU10 (Spotlight)</SelectItem>
                        <SelectItem value="G9">G9 (Bi-Pin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulb Shape */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Bulb Shape</Label>
                    <Select
                      value={params.bulbShape}
                      onValueChange={(value: BulbShape) => handleChange('bulbShape', value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="A19">A19 (Standard)</SelectItem>
                        <SelectItem value="A21">A21 (Large)</SelectItem>
                        <SelectItem value="Globe">Globe</SelectItem>
                        <SelectItem value="Candle">Candle</SelectItem>
                        <SelectItem value="Edison">Edison (Vintage)</SelectItem>
                        <SelectItem value="Tube">Tube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulb Wattage */}
                  <ParameterSlider
                    label="Bulb Wattage (LED)"
                    value={params.bulbWattage}
                    min={3}
                    max={25}
                    step={1}
                    unit="W"
                    onChange={(v) => handleChange('bulbWattage', v)}
                  />

                  {/* Heat Zone Toggle */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                    <div className="flex items-center gap-2">
                      <ThermometerSun className="w-4 h-4 text-amber-600" />
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Show Heat Zone</Label>
                        <p className="text-xs text-muted-foreground">
                          Visualize thermal clearance
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={params.showHeatZone}
                      onCheckedChange={(checked) => handleChange('showHeatZone', checked)}
                    />
                  </div>

                  {/* Heat warning for high wattage */}
                  {params.bulbWattage > 15 && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                      <Flame className="w-4 h-4 text-red-500 mt-0.5" />
                      <div className="text-xs text-red-700 dark:text-red-300">
                        <strong>Heat Warning:</strong> {params.bulbWattage}W may exceed safe limits for PLA. 
                        Consider PETG or ASA for heat resistance.
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ParametricStandControls;
