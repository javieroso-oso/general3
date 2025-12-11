import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Layout from '@/components/layout/Layout';
import LampScene3D from '@/components/3d/LampScene3D';
import ShadeControls from '@/components/lamp/ShadeControls';
import HardwareSelector from '@/components/lamp/HardwareSelector';
import PatternControls from '@/components/lamp/PatternControls';
import SafetyPanel from '@/components/lamp/SafetyPanel';
import { lampPresets } from '@/data/lamp-presets';
import { LampParams, LampHardware, defaultLampParams, defaultLampHardware, LampPreset, MountingParams, defaultMountingParams } from '@/types/lamp';
import { PrintSettings, defaultPrintSettings } from '@/types/parametric';
import { Lightbulb, Settings, Sparkles, Download, Flame, Grid3X3, PanelLeftClose, PanelLeft, Shield, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LampDesigner = () => {
  const [params, setParams] = useState<LampParams>(defaultLampParams);
  const [hardware, setHardware] = useState<LampHardware>(defaultLampHardware);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  
  const [showWireframe, setShowWireframe] = useState(false);
  const [showSocket, setShowSocket] = useState(true);
  const [showBulb, setShowBulb] = useState(true);
  const [showHeatZone, setShowHeatZone] = useState(false);
  const [showMounting, setShowMounting] = useState(true);
  
  const [panelOpen, setPanelOpen] = useState(true);
  
  const applyPreset = (preset: LampPreset) => {
    setParams(preset.params);
    setHardware(preset.hardware);
    toast.success(`Applied "${preset.name}" preset`);
  };
  
  const handleExportSTL = () => {
    toast.info('STL export coming soon');
  };

  const updateMounting = (key: keyof MountingParams, value: number) => {
    setParams({
      ...params,
      mounting: { ...params.mounting, [key]: value }
    });
  };
  
  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
        {/* Collapsible Left Panel */}
        <div className={cn(
          "border-r-2 border-border bg-card flex flex-col transition-all duration-300 shrink-0",
          panelOpen ? "w-80" : "w-0 overflow-hidden"
        )}>
          <div className="p-3 border-b-2 border-border bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              <h1 className="font-bold">Lamp Studio</h1>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setPanelOpen(false)}
              className="h-7 w-7"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          
          <Tabs defaultValue="shape" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-5 m-2 bg-muted/50">
              <TabsTrigger value="shape" className="text-[10px] px-1">
                <Settings className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="hardware" className="text-[10px] px-1">
                <Lightbulb className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="mounting" className="text-[10px] px-1">
                <Wrench className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="pattern" className="text-[10px] px-1">
                <Sparkles className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="presets" className="text-[10px] px-1">
                <Grid3X3 className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1">
              <div className="p-3">
                <TabsContent value="shape" className="m-0">
                  <ShadeControls params={params} onParamsChange={setParams} />
                </TabsContent>
                
                <TabsContent value="hardware" className="m-0">
                  <HardwareSelector hardware={hardware} onHardwareChange={setHardware} />
                </TabsContent>

                <TabsContent value="mounting" className="m-0">
                  <MountingControls 
                    lampStyle={hardware.lampStyle}
                    mounting={params.mounting}
                    onMountingChange={updateMounting}
                  />
                </TabsContent>
                
                <TabsContent value="pattern" className="m-0">
                  <PatternControls params={params} onParamsChange={setParams} />
                </TabsContent>
                
                <TabsContent value="presets" className="m-0">
                  <div className="grid grid-cols-1 gap-2">
                    {lampPresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className="p-2 rounded-lg border-2 border-border hover:border-primary bg-card text-left transition-all hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm">{preset.name}</h4>
                          <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {preset.hardware.lampStyle}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
        
        {/* Main 3D Preview Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Compact toolbar */}
          <div className="p-2 border-b-2 border-border bg-card flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              {!panelOpen && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setPanelOpen(true)}
                  className="h-8 w-8"
                >
                  <PanelLeft className="w-4 h-4" />
                </Button>
              )}
              
              <div className="flex items-center gap-2 text-xs">
                <Switch id="mounting" checked={showMounting} onCheckedChange={setShowMounting} className="scale-75" />
                <Label htmlFor="mounting" className="cursor-pointer text-xs">Mount</Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="socket" checked={showSocket} onCheckedChange={setShowSocket} className="scale-75" />
                <Label htmlFor="socket" className="cursor-pointer text-xs">Socket</Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="bulb" checked={showBulb} onCheckedChange={setShowBulb} className="scale-75" />
                <Label htmlFor="bulb" className="cursor-pointer text-xs">Bulb</Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="heat" checked={showHeatZone} onCheckedChange={setShowHeatZone} className="scale-75" />
                <Label htmlFor="heat" className="cursor-pointer text-xs flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Heat
                </Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="wireframe" checked={showWireframe} onCheckedChange={setShowWireframe} className="scale-75" />
                <Label htmlFor="wireframe" className="cursor-pointer text-xs">Wire</Label>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Material quick select */}
              <div className="flex items-center gap-1">
                {(['PLA', 'PETG', 'ABS'] as const).map((mat) => (
                  <button
                    key={mat}
                    onClick={() => setPrintSettings({ ...printSettings, material: mat })}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-bold transition-all',
                      printSettings.material === mat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {mat}
                  </button>
                ))}
              </div>
              
              {/* Safety Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <Shield className="w-3 h-3" />
                    Safety
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-80">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-secondary" />
                      Safety Analysis
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-6rem)] mt-4">
                    <SafetyPanel
                      params={params}
                      hardware={hardware}
                      printSettings={printSettings}
                    />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              
              <Button onClick={handleExportSTL} size="sm" className="gap-1 h-7 text-xs">
                <Download className="w-3 h-3" />
                Export
              </Button>
            </div>
          </div>
          
          {/* 3D Canvas - takes full remaining space */}
          <div className="flex-1 relative">
            <LampScene3D
              params={params}
              hardware={hardware}
              showWireframe={showWireframe}
              showSocket={showSocket}
              showBulb={showBulb}
              showHeatZone={showHeatZone}
              showMounting={showMounting}
            />
            
            {/* Compact info overlay */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border-2 border-border">
              <p className="text-xs font-mono">
                <span className="text-muted-foreground">H:</span>{params.height}mm
                <span className="mx-1.5 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Ø:</span>{params.baseRadius * 2}–{params.topRadius * 2}mm
                <span className="mx-1.5 text-muted-foreground">|</span>
                <span className="text-primary font-bold">{hardware.lampStyle}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Mounting controls component
import { Slider } from '@/components/ui/slider';

interface MountingControlsProps {
  lampStyle: LampHardware['lampStyle'];
  mounting: MountingParams;
  onMountingChange: (key: keyof MountingParams, value: number) => void;
}

const MountingControls = ({ lampStyle, mounting, onMountingChange }: MountingControlsProps) => {
  const SliderRow = ({ label, paramKey, min, max, step = 1 }: { 
    label: string; 
    paramKey: keyof MountingParams; 
    min: number; 
    max: number; 
    step?: number;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{mounting[paramKey]}mm</span>
      </div>
      <Slider
        value={[mounting[paramKey]]}
        onValueChange={([v]) => onMountingChange(paramKey, v)}
        min={min}
        max={max}
        step={step}
        className="py-1"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-xs font-bold text-primary uppercase">{lampStyle.replace('_', ' ')}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {lampStyle === 'pendant' && 'Ceiling-mounted with canopy and cord'}
          {lampStyle === 'table' && 'Weighted base with central stem'}
          {lampStyle === 'wall_sconce' && 'Wall-mounted with backplate'}
          {lampStyle === 'floor' && 'Pole adapter for floor lamp base'}
          {lampStyle === 'clip_on' && 'Rim clip for bare bulb fixtures'}
        </p>
      </div>

      {lampStyle === 'pendant' && (
        <>
          <SliderRow label="Canopy Diameter" paramKey="canopyDiameter" min={60} max={200} />
          <SliderRow label="Canopy Height" paramKey="canopyHeight" min={8} max={40} />
          <SliderRow label="Cord Channel" paramKey="cordChannelDiameter" min={5} max={15} />
        </>
      )}

      {lampStyle === 'table' && (
        <>
          <SliderRow label="Base Width" paramKey="baseWidth" min={80} max={250} />
          <SliderRow label="Base Height" paramKey="baseHeight" min={10} max={50} />
          <SliderRow label="Stem Diameter" paramKey="stemDiameter" min={12} max={40} />
          <SliderRow label="Stem Height" paramKey="stemHeight" min={30} max={150} />
        </>
      )}

      {lampStyle === 'wall_sconce' && (
        <>
          <SliderRow label="Backplate Width" paramKey="backplateWidth" min={50} max={150} />
          <SliderRow label="Backplate Height" paramKey="backplateHeight" min={60} max={200} />
          <SliderRow label="Arm Length" paramKey="armLength" min={20} max={120} />
          <SliderRow label="Arm Angle" paramKey="armAngle" min={0} max={45} />
        </>
      )}

      {lampStyle === 'floor' && (
        <>
          <SliderRow label="Pole Adapter Ø" paramKey="poleAdapterDiameter" min={20} max={50} />
          <SliderRow label="Adapter Height" paramKey="poleAdapterHeight" min={20} max={80} />
        </>
      )}

      {lampStyle === 'clip_on' && (
        <>
          <SliderRow label="Clip Width" paramKey="clipWidth" min={15} max={50} />
          <SliderRow label="Clip Depth" paramKey="clipDepth" min={15} max={40} />
        </>
      )}
    </div>
  );
};

export default LampDesigner;
