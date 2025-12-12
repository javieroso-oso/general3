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
import StandControls from '@/components/lamp/StandControls';
import HardwareSelector from '@/components/lamp/HardwareSelector';
import PatternControls from '@/components/lamp/PatternControls';
import SafetyPanel from '@/components/lamp/SafetyPanel';
import HardwareShoppingList from '@/components/lamp/HardwareShoppingList';
import { 
  LampParams, 
  LampHardware, 
  StandParams,
  defaultLampParams, 
  defaultLampHardware,
  defaultTripodParams,
  getDefaultStandParams,
} from '@/types/lamp';
import { PrintSettings, defaultPrintSettings } from '@/types/parametric';
import { downloadShadeSTL, downloadStandSTL, downloadLampParts } from '@/lib/lamp-stl-export';
import { Lightbulb, Settings, Sparkles, Download, Flame, Triangle, PanelLeftClose, PanelLeft, Shield, Eye, ShoppingCart, ChevronDown, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LampDesigner = () => {
  const [params, setParams] = useState<LampParams>(defaultLampParams);
  const [hardware, setHardware] = useState<LampHardware>(defaultLampHardware);
  const [standParams, setStandParams] = useState<StandParams>(defaultTripodParams);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  
  // Deferred params for smooth slider performance
  const deferredParams = useDeferredValue(params);
  const deferredStandParams = useDeferredValue(standParams);
  
  const [showWireframe, setShowWireframe] = useState(false);
  const [showSocket, setShowSocket] = useState(true);
  const [showBulb, setShowBulb] = useState(true);
  const [showHeatZone, setShowHeatZone] = useState(false);
  const [showStand, setShowStand] = useState(true);
  const [showShade, setShowShade] = useState(true);
  const [previewInstalled, setPreviewInstalled] = useState(false);
  
  const [panelOpen, setPanelOpen] = useState(true);
  
  // Sync rim diameter between shade and stand
  const handleStandChange = useCallback((newStandParams: StandParams) => {
    setStandParams(newStandParams);
    // Keep shade rim in sync
    if (newStandParams.rimDiameter !== params.shade.rimDiameter) {
      setParams(prev => ({
        ...prev,
        shade: { ...prev.shade, rimDiameter: newStandParams.rimDiameter }
      }));
    }
  }, [params.shade.rimDiameter]);
  
  // When stand type changes, also update hardware
  const handleHardwareChange = useCallback((newHardware: LampHardware) => {
    setHardware(newHardware);
    // Update stand type to match
    if (newHardware.standType !== standParams.type) {
      const newStand = getDefaultStandParams(newHardware.standType);
      newStand.rimDiameter = params.shade.rimDiameter;
      newStand.socketType = newHardware.socketType;
      setStandParams(newStand);
    }
  }, [standParams.type, params.shade.rimDiameter]);
  
  const handleExportShade = useCallback(() => {
    downloadShadeSTL(params, `lamp-shade-${params.shade.rimDiameter}mm.stl`);
    toast.success('Shade STL downloaded!');
  }, [params]);
  
  const handleExportStand = useCallback(() => {
    downloadStandSTL(standParams, `lamp-stand-${standParams.type}.stl`);
    toast.success('Stand STL downloaded!');
  }, [standParams]);
  
  const handleExportAll = useCallback(() => {
    downloadLampParts(params, standParams, 'lamp');
    toast.success('Both parts downloaded!');
  }, [params, standParams]);
  
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
          
          <Tabs defaultValue="shade" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-4 m-2 bg-muted/50">
              <TabsTrigger value="shade" className="text-[10px] px-1">
                <Layers className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="stand" className="text-[10px] px-1">
                <Triangle className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="hardware" className="text-[10px] px-1">
                <Lightbulb className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="pattern" className="text-[10px] px-1">
                <Sparkles className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1">
              <div className="p-3">
                <TabsContent value="shade" className="m-0">
                  <ShadeControls params={params} onParamsChange={setParams} />
                </TabsContent>
                
                <TabsContent value="stand" className="m-0">
                  <StandControls params={standParams} onParamsChange={handleStandChange} />
                </TabsContent>
                
                <TabsContent value="hardware" className="m-0">
                  <HardwareSelector hardware={hardware} onHardwareChange={handleHardwareChange} />
                </TabsContent>
                
                <TabsContent value="pattern" className="m-0">
                  <PatternControls params={params} onParamsChange={setParams} />
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
                <Switch id="shade" checked={showShade} onCheckedChange={setShowShade} className="scale-75" />
                <Label htmlFor="shade" className="cursor-pointer text-xs">Shade</Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="stand" checked={showStand} onCheckedChange={setShowStand} className="scale-75" />
                <Label htmlFor="stand" className="cursor-pointer text-xs">Stand</Label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch id="bulb" checked={showBulb} onCheckedChange={setShowBulb} className="scale-75" />
                <Label htmlFor="bulb" className="cursor-pointer text-xs">Bulb</Label>
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
                    <Layers className="w-4 h-4 mr-2" />
                    Download Shade STL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportStand}>
                    <Triangle className="w-4 h-4 mr-2" />
                    Download Stand STL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportAll}>
                    <Package className="w-4 h-4 mr-2" />
                    Download Both Parts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* 3D Canvas */}
          <div className="flex-1 relative">
            <LampScene3D
              params={deferredParams}
              hardware={hardware}
              standParams={deferredStandParams}
              showWireframe={showWireframe}
              showSocket={showSocket}
              showBulb={showBulb}
              showHeatZone={showHeatZone}
              showStand={showStand}
              showShade={showShade}
              previewInstalled={previewInstalled}
            />
            
            {/* Compact info overlay */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border-2 border-border">
              <p className="text-xs font-mono">
                <span className="text-muted-foreground">Shade:</span> H:{params.height}mm
                <span className="mx-1.5 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Rim:</span> Ø{params.shade.rimDiameter}mm
                <span className="mx-1.5 text-muted-foreground">|</span>
                <span className="text-primary font-bold">{standParams.type}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LampDesigner;
