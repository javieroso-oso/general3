import { 
  ParametricStandParams, 
  StandMountType, 
  StandStyle,
  LegProfile,
  HubStyle,
  FootStyle,
  ConnectionType,
  ScrewSize,
  MountingHoleCount,
  applyStylePreset,
  isWoojStyle
} from '@/types/stand';
import { SocketType } from '@/types/lamp';
import { StandardRimSize, ObjectType } from '@/types/parametric';
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
  Minus,
  Wrench
} from 'lucide-react';

interface ParametricStandControlsProps {
  params: ParametricStandParams;
  objectRimSize: StandardRimSize;
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
  objectRimSize,
  objectType,
  onChange 
}: ParametricStandControlsProps) => {
  const isLamp = objectType === 'lamp';
  const currentIsWooj = isWoojStyle(params.style);
  
  const handleChange = <K extends keyof ParametricStandParams>(
    key: K, 
    value: ParametricStandParams[K]
  ) => {
    onChange({ ...params, [key]: value });
  };

  const handleConnectionChange = <K extends keyof ParametricStandParams['connection']>(
    key: K,
    value: ParametricStandParams['connection'][K]
  ) => {
    onChange({ 
      ...params, 
      connection: { ...params.connection, [key]: value } 
    });
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
            Design a modular stand for your object
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
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium">
                Modular Connection
              </span>
              <p className="text-xs text-muted-foreground">
                {params.connection.holeCount}x {params.connection.screwSize} screws • {params.connection.plateThickness}mm plate
              </p>
            </div>
            <Badge variant="outline" className="text-primary border-primary/30">
              {objectRimSize}mm
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="style" className="w-full">
            <TabsList className={`grid w-full ${isLamp ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="style" className="gap-1.5 text-xs">
                <Palette className="w-3.5 h-3.5" />
                Style
              </TabsTrigger>
              <TabsTrigger value="customize" className="gap-1.5 text-xs">
                <Settings2 className="w-3.5 h-3.5" />
                Tune
              </TabsTrigger>
              <TabsTrigger value="connection" className="gap-1.5 text-xs">
                <Wrench className="w-3.5 h-3.5" />
                Connect
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
                    max={70}
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
                    max={16}
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

            {/* CONNECTION TAB */}
            <TabsContent value="connection" className="space-y-4 mt-4">
              <div className="p-3 bg-secondary/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  <Label className="text-sm font-medium">Mounting Hardware</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure the screw connection between your object and stand
                </p>
              </div>

              {/* Connection Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Connection Type</Label>
                <Select
                  value={params.connection.type}
                  onValueChange={(value: ConnectionType) => handleConnectionChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screw_insert">Screw + Heat-Set Insert</SelectItem>
                    <SelectItem value="friction">Friction Fit (no hardware)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {params.connection.type === 'screw_insert' && (
                <>
                  {/* Screw Size */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Screw Size</Label>
                    <Select
                      value={params.connection.screwSize}
                      onValueChange={(value: ScrewSize) => handleConnectionChange('screwSize', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M3">M3 (lighter objects)</SelectItem>
                        <SelectItem value="M4">M4 (heavier objects)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Hole Count */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Number of Screws</Label>
                    <Select
                      value={String(params.connection.holeCount)}
                      onValueChange={(value) => handleConnectionChange('holeCount', Number(value) as MountingHoleCount)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 screws</SelectItem>
                        <SelectItem value="4">4 screws</SelectItem>
                        <SelectItem value="6">6 screws (heavy duty)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Plate Thickness */}
              <ParameterSlider
                label="Plate Thickness"
                value={params.connection.plateThickness}
                min={4}
                max={8}
                step={1}
                unit="mm"
                onChange={(v) => handleConnectionChange('plateThickness', v)}
              />

              {/* Hardware shopping list */}
              {params.connection.type === 'screw_insert' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                    Hardware Shopping List:
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
                    <li>• {params.connection.holeCount}x {params.connection.screwSize} heat-set threaded inserts</li>
                    <li>• {params.connection.holeCount}x {params.connection.screwSize} × 8-12mm screws</li>
                    <li>• Soldering iron for insert installation</li>
                  </ul>
                </div>
              )}
            </TabsContent>

            {/* HARDWARE TAB (Lamps only) */}
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
              {currentIsWooj 
                ? 'WOOJ-inspired design with clean mounting plate. Object and stand connect via screws for easy assembly.'
                : 'Classic style with traditional cup socket. Switch to WOOJ styles for modular screw connection.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ParametricStandControls;