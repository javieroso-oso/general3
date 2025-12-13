import { 
  ParametricStandParams, 
  StandMountType, 
  StandStyle,
  LegProfile,
  HubStyle,
  FootStyle,
  applyStylePreset 
} from '@/types/stand';
import { SocketType } from '@/types/lamp';
import { StandardRimSize, ObjectType } from '@/types/parametric';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ParameterSlider from './ParameterSlider';
import StandStylePicker from './StandStylePicker';
import { Badge } from '@/components/ui/badge';
import { 
  Footprints, 
  Cable, 
  Grip, 
  CheckCircle2,
  Palette,
  Settings2,
  Sparkles,
  Lightbulb,
  Plug
} from 'lucide-react';

interface ParametricStandControlsProps {
  params: ParametricStandParams;
  objectRimSize: StandardRimSize;
  objectType: ObjectType;
  onChange: (params: ParametricStandParams) => void;
}

const ParametricStandControls = ({ 
  params, 
  objectRimSize,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const isLamp = objectType === 'lamp';
  
  const handleChange = <K extends keyof ParametricStandParams>(
    key: K, 
    value: ParametricStandParams[K]
  ) => {
    onChange({ ...params, [key]: value });
  };

  const handleStyleChange = (style: StandStyle) => {
    const updated = applyStylePreset(params, style);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Enable Stand Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Add Stand</Label>
          <p className="text-xs text-muted-foreground">
            Design a custom stand for your object
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

          {/* Auto-synced status */}
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <div className="flex-1">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Auto-matched to object
              </span>
              <p className="text-xs text-green-600 dark:text-green-500">
                Socket fits {objectRimSize}mm rim seamlessly
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {objectRimSize}mm
            </Badge>
          </div>

          {/* Tabs for Style, Customize, and Hardware */}
          <Tabs defaultValue="style" className="w-full">
            <TabsList className={`grid w-full ${isLamp ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="style" className="gap-2">
                <Palette className="w-4 h-4" />
                Style
              </TabsTrigger>
              <TabsTrigger value="customize" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Customize
              </TabsTrigger>
              {isLamp && (
                <TabsTrigger value="hardware" className="gap-2">
                  <Plug className="w-4 h-4" />
                  Hardware
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="style" className="space-y-4 mt-4">
              <StandStylePicker 
                value={params.style} 
                onChange={handleStyleChange} 
              />
              
              {/* Basic dimensions */}
              <ParameterSlider
                label="Stand Height"
                value={params.height}
                min={50}
                max={300}
                step={5}
                unit="mm"
                onChange={(v) => handleChange('height', v)}
              />

              {/* Mount-type specific */}
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
                    max={60}
                    step={1}
                    unit="°"
                    onChange={(v) => handleChange('legSpread', v)}
                  />
                </>
              )}

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
            </TabsContent>

            <TabsContent value="customize" className="space-y-4 mt-4">
              {/* Leg Profile */}
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
                    <SelectItem value="tapered">Tapered</SelectItem>
                    <SelectItem value="twisted">Twisted</SelectItem>
                    <SelectItem value="curved">Curved</SelectItem>
                    <SelectItem value="angular">Angular (Hex)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Leg Thickness"
                value={params.legThickness}
                min={4}
                max={20}
                step={0.5}
                unit="mm"
                onChange={(v) => handleChange('legThickness', v)}
              />

              <ParameterSlider
                label="Leg Curve"
                value={params.legCurve}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => handleChange('legCurve', v)}
              />

              <ParameterSlider
                label="Leg Twist"
                value={params.legTwist}
                min={0}
                max={360}
                step={15}
                unit="°"
                onChange={(v) => handleChange('legTwist', v)}
              />

              <ParameterSlider
                label="Leg Taper"
                value={params.legTaper}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => handleChange('legTaper', v)}
              />

              {/* Hub Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hub Style</Label>
                <Select
                  value={params.hubStyle}
                  onValueChange={(value: HubStyle) => handleChange('hubStyle', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smooth">Smooth</SelectItem>
                    <SelectItem value="sphere">Sphere</SelectItem>
                    <SelectItem value="disc">Disc</SelectItem>
                    <SelectItem value="cone">Cone</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Hub Scale"
                value={params.hubScale}
                min={0.5}
                max={2}
                step={0.1}
                onChange={(v) => handleChange('hubScale', v)}
              />

              {/* Foot Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Foot Style</Label>
                <Select
                  value={params.footStyle}
                  onValueChange={(value: FootStyle) => handleChange('footStyle', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pad">Pad</SelectItem>
                    <SelectItem value="sphere">Sphere</SelectItem>
                    <SelectItem value="spike">Spike</SelectItem>
                    <SelectItem value="flare">Flare</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ParameterSlider
                label="Foot Scale"
                value={params.footScale}
                min={0.5}
                max={2}
                step={0.1}
                onChange={(v) => handleChange('footScale', v)}
              />
            </TabsContent>

            {/* Hardware Tab (Lamps only) */}
            {isLamp && (
              <TabsContent value="hardware" className="space-y-4 mt-4">
                {/* Socket holder toggle */}
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Socket Holder
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Holds electrical bulb socket
                    </p>
                  </div>
                  <Switch
                    checked={params.showSocketHolder}
                    onCheckedChange={(checked) => handleChange('showSocketHolder', checked)}
                  />
                </div>

                {params.showSocketHolder && (
                  <>
                    {/* Socket type */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Socket Type</Label>
                      <Select
                        value={params.socketType}
                        onValueChange={(value: SocketType) => handleChange('socketType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="E26">E26 (Standard US)</SelectItem>
                          <SelectItem value="E27">E27 (Standard EU)</SelectItem>
                          <SelectItem value="E12">E12 (Candelabra)</SelectItem>
                          <SelectItem value="GU10">GU10 (Spotlight)</SelectItem>
                          <SelectItem value="G9">G9 (Halogen)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cord exit leg (tripod only) */}
                    {params.mountType === 'tripod' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Cord Exit Leg</Label>
                        <Select
                          value={String(params.cordExitLeg)}
                          onValueChange={(value) => handleChange('cordExitLeg', Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: params.legCount }).map((_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                Leg {i + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Power cord routes through this leg
                        </p>
                      </div>
                    )}

                    {/* Hardware info */}
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>Hardware needed:</strong> {params.socketType} socket, 18/2 lamp cord with plug, LED bulb (10W max for PLA)
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>
            )}
          </Tabs>

          {/* Info */}
          <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {isLamp 
                ? 'Design your stand, then configure hardware in the Hardware tab for a functional lamp.'
                : 'Choose a style preset for quick design, or switch to Customize for full parametric control.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ParametricStandControls;
