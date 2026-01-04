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
import DrawerPanel from '@/components/drawer/DrawerPanel';
import KeepButton from '@/components/drawer/KeepButton';
import { useDrawer } from '@/hooks/useDrawer';
import { 
  ParametricParams, 
  ObjectType, 
  defaultParams, 
  PrintSettings, 
  defaultPrintSettings,
  analyzePrint,
  PrintAnalysis,
} from '@/types/parametric';
import { MaterialPreset, MATERIAL_LABELS, MATERIAL_PRESETS, BackgroundPreset, BACKGROUND_PRESETS } from '@/types/materials';
import { downloadBodySTL, downloadLegsWithBaseSTL, downloadAllParts, downloadGCode, analyzeNonPlanarGCode } from '@/lib/stl-export';
import { downloadMoldSTL } from '@/lib/mold-generator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers, Package, Download, Eye, Play, Pause, FileCode, RotateCcw, Palette, Archive, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Index = () => {
  const [objectType, setObjectType] = useState<ObjectType>('vase');
  const [params, setParams] = useState<ParametricParams>(defaultParams.vase);
  
  // Drawer for storing designs locally
  const drawer = useDrawer();
  
  const handleLoadFromDrawer = useCallback((drawerParams: ParametricParams, drawerType: ObjectType) => {
    setObjectType(drawerType);
    setParams(drawerParams);
  }, []);
  
  const handleKeepToDrawer = useCallback((keepParams: ParametricParams, keepType: ObjectType, thumbnail: string) => {
    drawer.addItem(keepParams, keepType, thumbnail);
  }, [drawer]);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [showWireframe, setShowWireframe] = useState(false);
  const [viewMode, setViewMode] = useState<'model' | 'gcode'>('model');
  const [gcodeLayer, setGcodeLayer] = useState(0);
  const [gcodeShowAll, setGcodeShowAll] = useState(true);
  const [gcodeAnimate, setGcodeAnimate] = useState(false);
  const [materialPreset, setMaterialPreset] = useState<MaterialPreset>('ceramic');
  const [autoRotate, setAutoRotate] = useState(true);
  const [backgroundPreset, setBackgroundPreset] = useState<BackgroundPreset>('studio');
  const [customColor, setCustomColor] = useState<string | undefined>(undefined);
  const [usePresetColor, setUsePresetColor] = useState(true);
  
  // Leg/base material settings
  const [legMaterialPreset, setLegMaterialPreset] = useState<MaterialPreset>('wood');
  const [legCustomColor, setLegCustomColor] = useState<string | undefined>(undefined);
  const [useLegPresetColor, setUseLegPresetColor] = useState(true);
  const [syncLegMaterial, setSyncLegMaterial] = useState(true);

  const handleTypeChange = (type: ObjectType) => {
    setObjectType(type);
    setParams(defaultParams[type]);
  };

  const analysis = useMemo((): PrintAnalysis => {
    const baseAnalysis = analyzePrint(params, printSettings);
    
    // Add non-planar analysis when in non-planar mode
    if (printSettings.printMode === 'non_planar') {
      const nonPlanarAnalysis = analyzeNonPlanarGCode(params, objectType, printSettings);
      
      // Add non-planar specific warnings
      if (nonPlanarAnalysis.exceedsMaxAngle) {
        baseAnalysis.warnings.push({
          type: 'warning',
          code: 'NON_PLANAR_ANGLE',
          message: `Max tilt angle (${nonPlanarAnalysis.maxTiltAngle.toFixed(1)}°) exceeds setting (${printSettings.nonPlanar.maxZAngle}°)`,
          suggestion: 'Reduce surface curvature or increase max Z angle setting',
        });
      }
      
      if (nonPlanarAnalysis.collisionRiskZones.length > 10) {
        baseAnalysis.warnings.push({
          type: 'warning',
          code: 'COLLISION_RISK',
          message: `${nonPlanarAnalysis.collisionRiskZones.length} potential collision zones detected`,
          suggestion: 'Consider reducing max Z angle or simplifying the surface',
        });
      }
      
      return {
        ...baseAnalysis,
        nonPlanarAnalysis,
      };
    }
    
    return baseAnalysis;
  }, [params, printSettings, objectType]);

  const totalLayers = Math.ceil(params.height / printSettings.layerHeight);

  const handleExportBody = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const filename = `${objectType}_body_${params.height}mm_${Date.now()}.stl`;
    downloadBodySTL(params, objectType, filename);
    toast.success('Body STL exported!', { description: filename });
  }, [params, objectType, analysis.isValid]);

  const handleExportLegsBase = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const filename = `${objectType}_legs_base_${Date.now()}.stl`;
    downloadLegsWithBaseSTL(params, filename);
    toast.success('Legs + Base STL exported!', { description: filename });
  }, [params, analysis.isValid, objectType]);

  const handleExportAll = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
    downloadAllParts(params, objectType, baseName);
    toast.success('All parts exported!', { 
      description: params.addLegs ? 'Body + Legs/Base' : 'Body only' 
    });
  }, [params, objectType, analysis.isValid]);

  const handleExportGCode = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    const filename = `${objectType}_${params.height}mm_${printSettings.material}.gcode`;
    downloadGCode(params, objectType, printSettings, filename);
    toast.success('G-code exported!', { description: filename });
  }, [params, objectType, printSettings, analysis.isValid]);

  const handleExportMoldA = useCallback(() => {
    const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
    downloadMoldSTL(params, objectType, 'A', baseName);
    toast.success('Mold Half A exported!');
  }, [params, objectType]);

  const handleExportMoldB = useCallback(() => {
    const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
    downloadMoldSTL(params, objectType, 'B', baseName);
    toast.success('Mold Half B exported!');
  }, [params, objectType]);

  const handleExportBothMolds = useCallback(() => {
    const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
    downloadMoldSTL(params, objectType, 'both', baseName);
    toast.success('Both mold halves exported!');
  }, [params, objectType]);

  return (
    <Layout showFooter={false}>
      <div className="flex flex-col lg:flex-row">
        {/* Left Panel - Controls */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[380px] xl:w-[400px] border-r border-border bg-card"
        >
          {/* Object Type */}
          <div className="p-4 border-b border-border">
            <ObjectTypeTabs activeType={objectType} onTypeChange={handleTypeChange} />
          </div>

          {/* Tabbed Controls */}
          <Tabs defaultValue="design" className="flex flex-col">
            <TabsList className="mx-4 mt-4 grid grid-cols-5">
              <TabsTrigger value="design" className="text-xs gap-1">
                <Layers className="w-3 h-3" />
                Design
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
              <TabsTrigger value="drawer" className="text-xs gap-1 relative">
                <Archive className="w-3 h-3" />
                Drawer
                {drawer.count > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                    {drawer.count}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="p-4">
              <TabsContent value="design" className="mt-0 space-y-4">
                <ParameterControls
                  params={params}
                  type={objectType}
                  onParamsChange={setParams}
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

              <TabsContent value="drawer" className="mt-0">
                <DrawerPanel
                  items={drawer.items}
                  onLoad={handleLoadFromDrawer}
                  onRemove={drawer.removeItem}
                />
              </TabsContent>
            </div>
          </Tabs>
        </motion.aside>

        {/* Center - 3D Viewer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4 bg-background"
        >
          {/* Sticky container for 3D viewer */}
          <div className="lg:sticky lg:top-20 space-y-3">
            {/* View mode toggle */}
            <div className="flex items-center justify-between flex-wrap gap-2">
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
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Material Preset Selector */}
                  <Select value={materialPreset} onValueChange={(v) => setMaterialPreset(v as MaterialPreset)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border">
                      <SelectValue placeholder="Material" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(Object.keys(MATERIAL_LABELS) as MaterialPreset[]).map((preset) => (
                        <SelectItem key={preset} value={preset} className="text-xs">
                          {MATERIAL_LABELS[preset]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Body Color Picker */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Body:</span>
                    <input
                      type="color"
                      value={customColor || MATERIAL_PRESETS[materialPreset as keyof typeof MATERIAL_PRESETS]?.color || '#888888'}
                      onChange={(e) => {
                        setCustomColor(e.target.value);
                        setUsePresetColor(false);
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-border"
                      title="Body color"
                    />
                    {!usePresetColor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setUsePresetColor(true);
                          setCustomColor(undefined);
                        }}
                        title="Reset to preset color"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Leg/Base Material Controls */}
                  {params.addLegs && (
                    <div className="flex items-center gap-1 border-l border-border pl-2">
                      <Button
                        variant={syncLegMaterial ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSyncLegMaterial(!syncLegMaterial)}
                        className="text-xs h-8 px-2"
                        title={syncLegMaterial ? 'Legs match body material' : 'Legs have separate material'}
                      >
                        {syncLegMaterial ? '🔗' : '🔓'}
                      </Button>
                      
                      {!syncLegMaterial && (
                        <>
                          <Select value={legMaterialPreset} onValueChange={(v) => setLegMaterialPreset(v as MaterialPreset)}>
                            <SelectTrigger className="w-[100px] h-8 text-xs bg-card border-border">
                              <SelectValue placeholder="Leg Material" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              {(Object.keys(MATERIAL_LABELS) as MaterialPreset[]).map((preset) => (
                                <SelectItem key={preset} value={preset} className="text-xs">
                                  {MATERIAL_LABELS[preset]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <input
                            type="color"
                            value={legCustomColor || MATERIAL_PRESETS[legMaterialPreset as keyof typeof MATERIAL_PRESETS]?.color || '#888888'}
                            onChange={(e) => {
                              setLegCustomColor(e.target.value);
                              setUseLegPresetColor(false);
                            }}
                            className="w-8 h-8 rounded cursor-pointer border border-border"
                            title="Leg/base color"
                          />
                          {!useLegPresetColor && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setUseLegPresetColor(true);
                                setLegCustomColor(undefined);
                              }}
                              title="Reset leg color"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Background Selector */}
                  <Select value={backgroundPreset} onValueChange={(v) => setBackgroundPreset(v as BackgroundPreset)}>
                    <SelectTrigger className="w-[100px] h-8 text-xs bg-card border-border">
                      <Palette className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="BG" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(Object.keys(BACKGROUND_PRESETS) as BackgroundPreset[]).map((preset) => (
                        <SelectItem key={preset} value={preset} className="text-xs">
                          {BACKGROUND_PRESETS[preset].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Auto-rotate toggle */}
                  <Button
                    variant={autoRotate ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className="gap-1"
                  >
                    <RotateCcw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  </Button>
                  
                  <Button
                    variant={showWireframe ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setShowWireframe(!showWireframe)}
                  >
                    Wireframe
                  </Button>
                </div>
              )}
            </div>

            {/* 3D Viewer */}
            <div className="h-[500px] glass-panel-elevated overflow-hidden relative">
              <Scene3D 
                params={params} 
                type={objectType} 
                settings={printSettings}
                showWireframe={showWireframe}
                viewMode={viewMode}
                gcodeLayer={gcodeLayer}
                gcodeShowAll={gcodeShowAll}
                gcodeAnimate={gcodeAnimate}
                materialPreset={materialPreset}
                autoRotate={autoRotate}
                backgroundPreset={backgroundPreset}
                customColor={usePresetColor ? undefined : customColor}
                legMaterialPreset={syncLegMaterial ? materialPreset : legMaterialPreset}
                legCustomColor={syncLegMaterial ? (usePresetColor ? undefined : customColor) : (useLegPresetColor ? undefined : legCustomColor)}
              />
              
              {/* Dimensions overlay */}
              <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-mono">
                <div className="text-text-muted">
                  {params.height}mm × Ø{params.baseRadius * 2}mm
                </div>
                {params.addLegs && (
                  <div className="text-primary mt-1">
                    + {params.legHeight}mm legs
                  </div>
                )}
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
                className="p-4 bg-card rounded-xl border border-border space-y-4"
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
            <div className="flex gap-2 flex-wrap">
              {params.moldEnabled ? (
                <>
                  {/* Mold export buttons */}
                  <Button 
                    onClick={handleExportMoldA}
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <FlaskConical className="w-5 h-5" />
                    Mold A
                  </Button>
                  <Button 
                    onClick={handleExportMoldB}
                    variant="secondary"
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <FlaskConical className="w-5 h-5" />
                    Mold B
                  </Button>
                  <Button 
                    onClick={handleExportBothMolds}
                    variant="outline"
                    className="gap-2"
                    size="lg"
                  >
                    <Download className="w-5 h-5" />
                    Both
                  </Button>
                </>
              ) : (
                <>
                  {/* Standard export buttons */}
                  <KeepButton
                    params={params}
                    objectType={objectType}
                    onKeep={handleKeepToDrawer}
                  />
                  <Button 
                    onClick={handleExportBody} 
                    disabled={!analysis.isValid}
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <Download className="w-5 h-5" />
                    Body STL
                  </Button>
                  {params.addLegs && (
                    <Button 
                      onClick={handleExportLegsBase} 
                      disabled={!analysis.isValid}
                      variant="secondary"
                      className="flex-1 gap-2"
                      size="lg"
                    >
                      <Download className="w-5 h-5" />
                      Legs + Base
                    </Button>
                  )}
                  <Button 
                    onClick={handleExportGCode} 
                    disabled={!analysis.isValid}
                    variant="outline"
                    className="gap-2"
                    size="lg"
                  >
                    <FileCode className="w-5 h-5" />
                    G-code
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Print Analysis */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:block w-[300px] xl:sticky xl:top-20 xl:self-start border-l border-border bg-card p-4"
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
