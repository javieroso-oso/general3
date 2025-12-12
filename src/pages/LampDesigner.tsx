import { useState, useDeferredValue, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Layout from '@/components/layout/Layout';
import LampScene3D from '@/components/3d/LampScene3D';
import ShadeControls from '@/components/lamp/ShadeControls';
import HardwareSelector from '@/components/lamp/HardwareSelector';
import PatternControls from '@/components/lamp/PatternControls';
import SafetyPanel from '@/components/lamp/SafetyPanel';
import HardwareShoppingList from '@/components/lamp/HardwareShoppingList';
import { lampPresets } from '@/data/lamp-presets';
import { LampParams, LampHardware, defaultLampParams, defaultLampHardware, LampPreset } from '@/types/lamp';
import { PrintSettings, defaultPrintSettings } from '@/types/parametric';
import { downloadShadeSTL, downloadLampParts } from '@/lib/lamp-stl-export';
import { Lightbulb, Settings, Sparkles, Download, Flame, Grid3X3, PanelLeftClose, PanelLeft, Shield, Eye, ShoppingCart, ChevronDown, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LampDesigner = () => {
  const [params, setParams] = useState<LampParams>(defaultLampParams);
  const [hardware, setHardware] = useState<LampHardware>(defaultLampHardware);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  
  // Deferred params for smooth slider performance
  const deferredParams = useDeferredValue(params);
  const deferredHardware = useDeferredValue(hardware);
  
  const [showWireframe, setShowWireframe] = useState(false);
  const [showSocket, setShowSocket] = useState(true);
  const [showBulb, setShowBulb] = useState(true);
  const [showHeatZone, setShowHeatZone] = useState(false);
  const [previewInstalled, setPreviewInstalled] = useState(false);
  
  const [panelOpen, setPanelOpen] = useState(true);
  
  const applyPreset = useCallback((preset: LampPreset) => {
    setParams(preset.params);
    setHardware(preset.hardware);
    toast.success(`Applied "${preset.name}" preset`);
  }, []);
  
  const handleExportShade = useCallback(() => {
    downloadShadeSTL(params, hardware, `lamp-${hardware.lampStyle}-shade.stl`);
    toast.success('Shade STL downloaded!');
  }, [params, hardware]);
  
  const handleExportAllParts = useCallback(() => {
    downloadLampParts(params, hardware, `lamp-${hardware.lampStyle}`);
    toast.success('All parts downloaded!');
  }, [params, hardware]);
  
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
            <TabsList className="grid grid-cols-4 m-2 bg-muted/50">
              <TabsTrigger value="shape" className="text-[10px] px-1">
                <Settings className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="hardware" className="text-[10px] px-1">
                <Lightbulb className="w-3 h-3" />
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
              <div className="flex items-center gap-2 text-xs">
                <Switch id="preview-installed" checked={previewInstalled} onCheckedChange={setPreviewInstalled} className="scale-75" />
                <Label htmlFor="preview-installed" className="cursor-pointer text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Installed
                </Label>
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
              
              {/* Hardware List Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <ShoppingCart className="w-3 h-3" />
                    Parts
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-96">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Hardware Shopping List
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
                    <HardwareShoppingList
                      hardware={hardware}
                      material={printSettings.material}
                    />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              
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
              
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1 h-7 text-xs">
                    <Download className="w-3 h-3" />
                    Export
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportShade}>
                    <Package className="w-4 h-4 mr-2" />
                    Download Shade STL
                  </DropdownMenuItem>
                  {hardware.lampStyle === 'wall_sconce' && (
                    <DropdownMenuItem onClick={handleExportAllParts}>
                      <Download className="w-4 h-4 mr-2" />
                      Download All Parts
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    G-code export coming soon
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* 3D Canvas - takes full remaining space */}
          <div className="flex-1 relative">
            <LampScene3D
              params={deferredParams}
              hardware={deferredHardware}
              showWireframe={showWireframe}
              showSocket={showSocket}
              showBulb={showBulb}
              showHeatZone={showHeatZone}
              previewInstalled={previewInstalled}
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

export default LampDesigner;
