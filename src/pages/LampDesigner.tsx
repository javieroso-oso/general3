import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import Layout from '@/components/layout/Layout';
import LampScene3D from '@/components/3d/LampScene3D';
import ShadeControls from '@/components/lamp/ShadeControls';
import HardwareSelector from '@/components/lamp/HardwareSelector';
import PatternControls from '@/components/lamp/PatternControls';
import SafetyPanel from '@/components/lamp/SafetyPanel';
import { lampPresets } from '@/data/lamp-presets';
import { LampParams, LampHardware, defaultLampParams, defaultLampHardware, LampPreset } from '@/types/lamp';
import { PrintSettings, defaultPrintSettings } from '@/types/parametric';
import { Lightbulb, Settings, Sparkles, Download, Eye, EyeOff, Flame, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LampDesigner = () => {
  const [params, setParams] = useState<LampParams>(defaultLampParams);
  const [hardware, setHardware] = useState<LampHardware>(defaultLampHardware);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  
  const [showWireframe, setShowWireframe] = useState(false);
  const [showSocket, setShowSocket] = useState(true);
  const [showBulb, setShowBulb] = useState(true);
  const [showHeatZone, setShowHeatZone] = useState(true);
  
  const applyPreset = (preset: LampPreset) => {
    setParams(preset.params);
    setHardware(preset.hardware);
    toast.success(`Applied "${preset.name}" preset`);
  };
  
  const handleExportSTL = () => {
    toast.info('STL export coming soon');
  };
  
  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Left Panel - Controls */}
        <div className="w-full lg:w-80 xl:w-96 border-r-2 border-border bg-card flex flex-col">
          <div className="p-4 border-b-2 border-border bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Lamp Studio</h1>
                <p className="text-xs text-muted-foreground">Design custom lamp shades</p>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="shape" className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 m-2 bg-muted/50">
              <TabsTrigger value="shape" className="text-xs">
                <Settings className="w-3 h-3 mr-1" />
                Shape
              </TabsTrigger>
              <TabsTrigger value="hardware" className="text-xs">
                <Lightbulb className="w-3 h-3 mr-1" />
                Hardware
              </TabsTrigger>
              <TabsTrigger value="pattern" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Pattern
              </TabsTrigger>
              <TabsTrigger value="presets" className="text-xs">
                <Grid3X3 className="w-3 h-3 mr-1" />
                Presets
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1">
              <div className="p-4">
                <TabsContent value="shape" className="m-0">
                  <ShadeControls params={params} onParamsChange={setParams} />
                </TabsContent>
                
                <TabsContent value="hardware" className="m-0">
                  <HardwareSelector hardware={hardware} onHardwareChange={setHardware} />
                </TabsContent>
                
                <TabsContent value="pattern" className="m-0">
                  <PatternControls params={params} onParamsChange={setParams} />
                </TabsContent>
                
                <TabsContent value="presets" className="m-0">
                  <div className="grid grid-cols-2 gap-3">
                    {lampPresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className="p-3 rounded-lg border-2 border-border hover:border-primary bg-card text-left transition-all hover:shadow-lg"
                      >
                        <h4 className="font-bold text-sm">{preset.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
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
        
        {/* Center - 3D Preview */}
        <div className="flex-1 flex flex-col min-h-[400px] lg:min-h-0">
          {/* View Controls */}
          <div className="p-3 border-b-2 border-border bg-card flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch 
                  id="wireframe" 
                  checked={showWireframe} 
                  onCheckedChange={setShowWireframe}
                />
                <Label htmlFor="wireframe" className="text-xs cursor-pointer">Wireframe</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="socket" 
                  checked={showSocket} 
                  onCheckedChange={setShowSocket}
                />
                <Label htmlFor="socket" className="text-xs cursor-pointer">Socket</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="bulb" 
                  checked={showBulb} 
                  onCheckedChange={setShowBulb}
                />
                <Label htmlFor="bulb" className="text-xs cursor-pointer">Bulb</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="heat" 
                  checked={showHeatZone} 
                  onCheckedChange={setShowHeatZone}
                />
                <Label htmlFor="heat" className="text-xs cursor-pointer flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Heat Zone
                </Label>
              </div>
            </div>
            
            <Button onClick={handleExportSTL} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export STL
            </Button>
          </div>
          
          {/* 3D Canvas */}
          <div className="flex-1 relative">
            <LampScene3D
              params={params}
              hardware={hardware}
              showWireframe={showWireframe}
              showSocket={showSocket}
              showBulb={showBulb}
              showHeatZone={showHeatZone}
            />
            
            {/* Dimensions overlay */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border-2 border-border">
              <p className="text-xs font-mono">
                <span className="text-muted-foreground">H:</span> {params.height}mm
                <span className="mx-2 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Ø:</span> {params.baseRadius * 2}–{params.topRadius * 2}mm
              </p>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Safety Analysis */}
        <div className="w-full lg:w-72 xl:w-80 border-l-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border bg-secondary/5">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-secondary" />
              <h2 className="font-bold">Safety Analysis</h2>
            </div>
          </div>
          
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="p-4">
              <SafetyPanel
                params={params}
                hardware={hardware}
                printSettings={printSettings}
              />
              
              {/* Material Selection */}
              <div className="mt-6 pt-4 border-t-2 border-border">
                <Label className="text-xs font-bold uppercase tracking-wider mb-3 block">
                  Print Material
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PLA', 'PETG', 'ABS', 'TPU'] as const).map((mat) => (
                    <button
                      key={mat}
                      onClick={() => setPrintSettings({ ...printSettings, material: mat })}
                      className={cn(
                        'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                        printSettings.material === mat
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </Layout>
  );
};

export default LampDesigner;
