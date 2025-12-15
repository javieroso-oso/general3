import { 
  ParametricStandParams, 
  StandMountType, 
  StandStyle,
  LegProfile,
  HubStyle,
  FootStyle,
  PlugSize,
  plugSizes,
  applyStylePreset,
  isWoojStyle
} from '@/types/stand';
import { SocketType } from '@/types/lamp';
import { SocketSize, ObjectType } from '@/types/parametric';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ParameterSlider from './ParameterSlider';
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
  Plug,
  Circle,
  Columns,
} from 'lucide-react';

interface ParametricStandControlsProps {
  params: ParametricStandParams;
  objectSocketSize: SocketSize;
  objectType: ObjectType;
  onChange: (params: ParametricStandParams) => void;
}

// WOOJ-inspired style cards
const woojStyles: { id: StandStyle; name: string; icon: React.ReactNode; description: string }[] = [
  { 
    id: 'wooj_splayed', 
    name: 'Splayed', 
    icon: <Footprints className="w-5 h-5" />,
    description: 'Ultra-thin legs, no hub'
  },
  { 
    id: 'ribbed_pedestal', 
    name: 'Ribbed', 
    icon: <Columns className="w-5 h-5" />,
    description: 'Fluted cylinder base'
  },
  { 
    id: 'floating_ring', 
    name: 'Ring', 
    icon: <Circle className="w-5 h-5" />,
    description: 'Minimal torus base'
  },
];

// Classic style options
const classicStyles: { id: StandStyle; name: string }[] = [
  { id: 'minimalist', name: 'Minimalist' },
  { id: 'industrial', name: 'Industrial' },
  { id: 'art_deco', name: 'Art Deco' },
  { id: 'organic', name: 'Organic' },
  { id: 'retro', name: 'Retro' },
  { id: 'brutalist', name: 'Brutalist' },
];

const ParametricStandControls = ({ 
  params, 
  objectSocketSize,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const isLamp = objectType === 'lamp';
  const currentIsWooj = isWoojStyle(params.style);
  const sizesMatch = params.plugSize === objectSocketSize;
  
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
            Internal plug fits flush inside object
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

          {/* Connection status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
            sizesMatch 
              ? 'bg-primary/10 border-primary/20' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
          }`}>
            <CheckCircle2 className={`w-4 h-4 ${sizesMatch ? 'text-primary' : 'text-amber-600'}`} />
            <div className="flex-1">
              <span className="text-sm font-medium">
                {sizesMatch ? 'Flush Connection' : 'Size Mismatch'}
              </span>
              <p className="text-xs text-muted-foreground">
                Plug: {params.plugSize}mm • Socket: {objectSocketSize}mm
              </p>
            </div>
            <Badge variant="outline" className={sizesMatch ? 'text-primary border-primary/30' : 'text-amber-600 border-amber-300'}>
              {params.plugSize}mm
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="style" className="w-full">
            <TabsList className={`grid w-full ${isLamp ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="style" className="gap-1.5 text-xs">
                <Palette className="w-3.5 h-3.5" />
                Style
              </TabsTrigger>
              <TabsTrigger value="customize" className="gap-1.5 text-xs">
                <Settings2 className="w-3.5 h-3.5" />
                Tune
              </TabsTrigger>
              {isLamp && (
                <TabsTrigger value="hardware" className="gap-1.5 text-xs">
                  <Plug className="w-3.5 h-3.5" />
                  Elec
                </TabsTrigger>
              )}
            </TabsList>

            {/* STYLE TAB */}
            <TabsContent value="style" className="space-y-4 mt-4">
              {/* WOOJ-Inspired Styles */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  WOOJ-Inspired
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {woojStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => handleStyleChange(style.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        params.style === style.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 bg-background'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        {style.icon}
                        <span className="text-xs font-medium">{style.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Classic Styles Dropdown */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Classic Styles
                </Label>
                <Select
                  value={classicStyles.find(s => s.id === params.style)?.id ?? ''}
                  onValueChange={(value: StandStyle) => handleStyleChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select classic style..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classicStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        {size}mm {size === objectSocketSize && '(matches object)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Must match object socket size for flush fit
                </p>
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
                    min={20}
                    max={50}
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

              {/* WOOJ-specific controls */}
              {params.style === 'ribbed_pedestal' && (
                <ParameterSlider
                  label="Rib Count"
                  value={params.ribCount}
                  min={8}
                  max={32}
                  step={2}
                  onChange={(v) => handleChange('ribCount', v)}
                />
              )}

              {params.style === 'floating_ring' && (
                <ParameterSlider
                  label="Ring Thickness"
                  value={params.ringThickness}
                  min={4}
                  max={12}
                  step={1}
                  unit="mm"
                  onChange={(v) => handleChange('ringThickness', v)}
                />
              )}
            </TabsContent>

            {/* CUSTOMIZE TAB */}
            <TabsContent value="customize" className="space-y-4 mt-4">
              {/* Only show leg controls for non-pedestal/ring styles */}
              {params.style !== 'ribbed_pedestal' && params.style !== 'floating_ring' && (
                <>
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
                    min={2}
                    max={12}
                    step={0.5}
                    unit="mm"
                    onChange={(v) => handleChange('legThickness', v)}
                  />

                  {!currentIsWooj && (
                    <ParameterSlider
                      label="Leg Curve"
                      value={params.legCurve}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => handleChange('legCurve', v)}
                    />
                  )}

                  <ParameterSlider
                    label="Leg Taper"
                    value={params.legTaper}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => handleChange('legTaper', v)}
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
                        <SelectItem value="spike">Spike (Point)</SelectItem>
                        <SelectItem value="sphere">Sphere</SelectItem>
                        <SelectItem value="pad">Pad</SelectItem>
                        <SelectItem value="flare">Flare</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <ParameterSlider
                    label="Foot Scale"
                    value={params.footScale}
                    min={0.3}
                    max={1.5}
                    step={0.1}
                    onChange={(v) => handleChange('footScale', v)}
                  />
                </>
              )}

              {/* Hub controls (only for classic styles) */}
              {!currentIsWooj && (
                <>
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
                        <SelectItem value="hidden">Hidden</SelectItem>
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
                </>
              )}

              {(params.style === 'ribbed_pedestal' || params.style === 'floating_ring') && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {params.style === 'ribbed_pedestal' 
                      ? 'Ribbed pedestal uses a continuous fluted cylinder. Adjust rib count in Style tab.'
                      : 'Floating ring uses a minimal torus base. Adjust ring thickness in Style tab.'}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* HARDWARE TAB (Lamps only) */}
            {isLamp && (
              <TabsContent value="hardware" className="space-y-4 mt-4">
                {/* Socket holder toggle */}
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Socket Holder</Label>
                    <p className="text-xs text-muted-foreground">
                      Integrated holder for electrical socket
                    </p>
                  </div>
                  <Switch
                    checked={params.showSocketHolder}
                    onCheckedChange={(checked) => handleChange('showSocketHolder', checked)}
                  />
                </div>

                {params.showSocketHolder && (
                  <>
                    {/* Socket Type */}
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
                          <SelectItem value="E26">E26 (US Standard)</SelectItem>
                          <SelectItem value="E27">E27 (EU Standard)</SelectItem>
                          <SelectItem value="E12">E12 (Candelabra)</SelectItem>
                          <SelectItem value="GU10">GU10 (Spotlight)</SelectItem>
                          <SelectItem value="G9">G9 (Halogen/LED)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cord Exit Leg (tripod only) */}
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
                            {Array.from({ length: params.legCount }, (_, i) => (
                              <SelectItem key={i} value={String(i)}>
                                Leg {i + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Which leg has the cord channel
                        </p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            )}
          </Tabs>

          {/* Info about flush connection */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3 inline mr-1" />
              The stand's plug fits invisibly inside your object's hollow base for a seamless, flush connection.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ParametricStandControls;