import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import Scene3D from '@/components/3d/Scene3D';
import ParameterControls from '@/components/controls/ParameterControls';
import PresetGallery from '@/components/controls/PresetGallery';
import ObjectTypeTabs from '@/components/controls/ObjectTypeTabs';
import PrintAnalysisPanel from '@/components/controls/PrintAnalysisPanel';
import PrintSettingsPanel from '@/components/controls/PrintSettingsPanel';
import BatchGenerator from '@/components/controls/BatchGenerator';
import StandControls from '@/components/controls/StandControls';
import { 
  ParametricParams, 
  ObjectType, 
  defaultParams, 
  PrintSettings, 
  defaultPrintSettings,
  analyzePrint,
  StandParams,
  defaultStandParams,
} from '@/types/parametric';
import { downloadSTL, downloadGCode, downloadStandSTL } from '@/lib/stl-export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers, Package, Download, Eye, Play, Pause, FileCode, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const Index = () => {
  const [objectType, setObjectType] = useState<ObjectType>('vase');
  const [params, setParams] = useState<ParametricParams>(defaultParams.vase);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [showWireframe, setShowWireframe] = useState(false);
  const [viewMode, setViewMode] = useState<'model' | 'gcode'>('model');
  const [gcodeLayer, setGcodeLayer] = useState(0);
  const [gcodeShowAll, setGcodeShowAll] = useState(true);
  const [gcodeAnimate, setGcodeAnimate] = useState(false);
  const [standParams, setStandParams] = useState<StandParams>(defaultStandParams);

  const handleTypeChange = (type: ObjectType) => {
    setObjectType(type);
    setParams(defaultParams[type]);
  };

  const analysis = useMemo(() => 
    analyzePrint(params, printSettings), 
    [params, printSettings]
  );

  const totalLayers = Math.ceil(params.height / printSettings.layerHeight);

  const handleExportSTL = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const filename = `${objectType}_${params.height}mm_${Date.now()}.stl`;
    downloadSTL(params, objectType, filename);
    toast.success('STL exported!', {
      description: filename,
    });
  }, [params, objectType, analysis.isValid]);

  const handleExportGCode = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const filename = `${objectType}_${params.height}mm_${printSettings.material}.gcode`;
    downloadGCode(params, objectType, printSettings, filename);
    toast.success('G-code exported!', {
      description: filename,
    });
  }, [params, objectType, printSettings, analysis.isValid]);

  const handleExportStand = useCallback(() => {
    if (!standParams.enabled || standParams.type === 'none') {
      toast.error('No stand configured');
      return;
    }
    
    const filename = `stand_${standParams.type}_${Date.now()}.stl`;
    
    // Calculate a standard rim size
    const rimSize = Math.round(params.baseRadius * 2 / 50) * 50 || 150;
    const standardRim = (rimSize < 125 ? 100 : rimSize < 175 ? 150 : rimSize < 225 ? 200 : 250) as 100 | 150 | 200 | 250;
    
    downloadStandSTL({
      type: standParams.type === 'tripod' ? 'tripod' : 
            standParams.type === 'pendant' ? 'pendant_cord' : 'wall_arm',
      socketType: 'E26',
      rimDiameter: standardRim,
      height: standParams.height,
      wallThickness: 3,
      legCount: standParams.legCount,
      legSpread: standParams.legSpread,
      legThickness: 8,
      socketHolderHeight: 80,
      cordLength: standParams.cordLength,
      canopyDiameter: 80,
      canopyHeight: 25,
      armLength: standParams.armLength,
      armAngle: standParams.armAngle,
      backplateWidth: 100,
      backplateHeight: 140,
    } as any, filename);
    toast.success('Stand STL exported!', {
      description: filename,
    });
  }, [standParams, params.baseRadius]);

  return (
    <Layout showFooter={false}>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Left Panel - Controls */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[380px] xl:w-[400px] border-r border-border bg-card flex flex-col"
        >
          {/* Object Type */}
          <div className="p-4 border-b border-border">
            <ObjectTypeTabs activeType={objectType} onTypeChange={handleTypeChange} />
          </div>

          {/* Tabbed Controls */}
          <Tabs defaultValue="design" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4 grid grid-cols-5">
              <TabsTrigger value="design" className="text-xs gap-1">
                <Layers className="w-3 h-3" />
                Design
              </TabsTrigger>
              <TabsTrigger value="stand" className="text-xs gap-1">
                <Footprints className="w-3 h-3" />
                Stand
              </TabsTrigger>
              <TabsTrigger value="print" className="text-xs gap-1">
                <Settings2 className="w-3 h-3" />
                Print
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-xs gap-1">
                <Package className="w-3 h-3" />
                Batch
              </TabsTrigger>
              <TabsTrigger value="presets" className="text-xs gap-1">
                Presets
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="design" className="mt-0 space-y-4">
                <ParameterControls
                  params={params}
                  type={objectType}
                  onParamsChange={setParams}
                />
              </TabsContent>

              <TabsContent value="stand" className="mt-0 space-y-4">
                <StandControls
                  params={standParams}
                  objectBaseRadius={params.baseRadius}
                  onChange={setStandParams}
                />
              </TabsContent>

              <TabsContent value="print" className="mt-0 space-y-4">
                <PrintSettingsPanel
                  settings={printSettings}
                  onSettingsChange={setPrintSettings}
                />
              </TabsContent>

              <TabsContent value="batch" className="mt-0">
                <BatchGenerator
                  baseParams={params}
                  printSettings={printSettings}
                  onSelectVariation={setParams}
                />
              </TabsContent>

              <TabsContent value="presets" className="mt-0">
                <PresetGallery
                  type={objectType}
                  currentParams={params}
                  onSelect={setParams}
                />
              </TabsContent>
            </div>
          </Tabs>
        </motion.aside>

        {/* Center - 3D Viewer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4 bg-background flex flex-col"
        >
          {/* View mode toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'model' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('model')}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Model
              </Button>
              <Button
                variant={viewMode === 'gcode' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('gcode')}
                className="gap-2"
              >
                <FileCode className="w-4 h-4" />
                G-code Preview
              </Button>
            </div>
            
            {viewMode === 'model' && (
              <Button
                variant={showWireframe ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowWireframe(!showWireframe)}
              >
                Wireframe
              </Button>
            )}
          </div>

          {/* 3D Viewer */}
          <div className="flex-1 glass-panel-elevated overflow-hidden relative">
            <Scene3D 
              params={params} 
              type={objectType} 
              settings={printSettings}
              showWireframe={showWireframe}
              viewMode={viewMode}
              gcodeLayer={gcodeLayer}
              gcodeShowAll={gcodeShowAll}
              gcodeAnimate={gcodeAnimate}
              standParams={standParams}
            />
            
            {/* Dimensions overlay */}
            <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-mono">
              <div className="text-text-muted">
                {params.height}mm × Ø{params.baseRadius * 2}mm
              </div>
              {viewMode === 'gcode' && (
                <div className="text-primary mt-1">
                  Layer {gcodeAnimate ? '...' : gcodeLayer + 1} / {totalLayers}
                </div>
              )}
            </div>
          </div>

          {/* G-code controls */}
          {viewMode === 'gcode' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-4 bg-card rounded-xl border border-border space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Layer Scrubber</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Show All</span>
                    <Switch checked={gcodeShowAll} onCheckedChange={setGcodeShowAll} />
                  </div>
                  <Button
                    variant={gcodeAnimate ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGcodeAnimate(!gcodeAnimate)}
                    className="gap-2"
                  >
                    {gcodeAnimate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {gcodeAnimate ? 'Pause' : 'Simulate'}
                  </Button>
                </div>
              </div>
              
              {!gcodeAnimate && (
                <div className="space-y-2">
                  <Slider
                    value={[gcodeLayer]}
                    min={0}
                    max={totalLayers - 1}
                    step={1}
                    onValueChange={([v]) => setGcodeLayer(v)}
                  />
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Layer 1 (0mm)</span>
                    <span>Layer {totalLayers} ({params.height}mm)</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Export buttons */}
          <div className="mt-3 flex gap-2">
            <Button 
              onClick={handleExportSTL} 
              disabled={!analysis.isValid}
              className="flex-1 gap-2"
              size="lg"
            >
              <Download className="w-5 h-5" />
              Export Object
            </Button>
            {standParams.enabled && standParams.type !== 'none' && (
              <Button 
                onClick={handleExportStand} 
                variant="outline"
                className="gap-2"
                size="lg"
              >
                <Footprints className="w-5 h-5" />
                Export Stand
              </Button>
            )}
            <Button 
              onClick={handleExportGCode} 
              disabled={!analysis.isValid}
              variant="secondary"
              className="gap-2"
              size="lg"
            >
              <FileCode className="w-5 h-5" />
              G-code
            </Button>
          </div>
        </motion.div>

        {/* Right Panel - Print Analysis */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:block w-[300px] border-l border-border bg-card overflow-y-auto p-4"
        >
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Print Analysis
          </h2>
          <PrintAnalysisPanel analysis={analysis} settings={printSettings} />
        </motion.aside>
      </div>
    </Layout>
  );
};

export default Index;
