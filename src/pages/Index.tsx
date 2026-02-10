import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Scene3D from '@/components/3d/Scene3D';
import ParameterControls from '@/components/controls/ParameterControls';
import PresetGallery from '@/components/controls/PresetGallery';
import ObjectTypeTabs from '@/components/controls/ObjectTypeTabs';
import PrintAnalysisPanel from '@/components/controls/PrintAnalysisPanel';
import PrintSettingsPanel from '@/components/controls/PrintSettingsPanel';
import BatchGenerator from '@/components/controls/BatchGenerator';
import DrawerPanel from '@/components/drawer/DrawerPanel';
import KeepButton from '@/components/drawer/KeepButton';
import PlotterKeepButton from '@/components/drawer/PlotterKeepButton';
import Header from '@/components/layout/Header';
import ExportPaymentDialog from '@/components/ExportPaymentDialog';
import PlotterPreview from '@/components/plotter/PlotterPreview';
import PlotterControls from '@/components/plotter/PlotterControls';
import { useDrawer } from '@/hooks/useDrawer';
import { useLicenseKey } from '@/hooks/useLicenseKey';
import { usePlotterDrawing } from '@/hooks/usePlotterDrawing';
import { 
  ParametricParams, 
  ObjectType,
  ShapeStyle,
  defaultShapeParams,
  defaultParams, 
  PrintSettings, 
  defaultPrintSettings,
  analyzePrint,
  PrintAnalysis,
} from '@/types/parametric';
import { PlotterParams, PlotterDrawing, defaultPlotterParams } from '@/types/plotter';
import { MaterialPreset, MATERIAL_LABELS, MATERIAL_PRESETS, BackgroundPreset, BACKGROUND_PRESETS } from '@/types/materials';
import { downloadBodySTL, downloadLegsWithBaseSTL, downloadAllParts, downloadGCode, analyzeNonPlanarGCode, exportBodyToSTL } from '@/lib/stl-export';
import { ExportType } from '@/config/export-pricing';
import { downloadMoldSTL, downloadMultiPartMoldSTL, generateMoldGeometry, generateMultiPartMoldGeometry, exportMoldHalfToSTL } from '@/lib/mold-generator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers, Package, Download, Eye, Play, Pause, FileCode, RotateCcw, Palette, Archive, FlaskConical, ChevronLeft, ChevronRight, Info, PackageCheck, Share2 } from 'lucide-react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGallery } from '@/hooks/useGallery';
import AddToGalleryDialog from '@/components/AddToGalleryDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Index = () => {
  const [objectType, setObjectType] = useState<ObjectType>('shape');
  const [params, setParams] = useState<ParametricParams>(defaultShapeParams.vase);
  const [plotterParams, setPlotterParams] = useState<PlotterParams>(defaultPlotterParams);
  
  // Plotter drawing (computed from plotter params + live mesh params)
  const plotterDrawing = usePlotterDrawing({
    params: plotterParams,
    currentMeshParams: params,
    currentShapeStyle: params.shapeStyle,
  });
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  // Drawer for storing designs locally
  const drawer = useDrawer();
  const { isUnlocked } = useLicenseKey();
  
  // Export payment dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<ExportType>('body');
  const [pendingMoldPart, setPendingMoldPart] = useState<'A' | 'B' | 'both' | number | null>(null);
  
  // Gallery integration
  const gallery = useGallery();
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  
  const handleAddToGallery = useCallback(async (name: string, description?: string) => {
    return gallery.addDesign(name, params, objectType, description);
  }, [gallery, params, objectType]);
  
  const handleLoadFromDrawer = useCallback((drawerParams: ParametricParams, drawerType: ObjectType) => {
    setObjectType(drawerType);
    setParams(drawerParams);
  }, []);
  
  const handleLoadPlotterFromDrawer = useCallback((drawerPlotterParams: PlotterParams, _drawing: PlotterDrawing) => {
    setObjectType('plotter');
    setPlotterParams(drawerPlotterParams);
  }, []);
  
  const handleKeepToDrawer = useCallback((keepParams: ParametricParams, keepType: ObjectType, thumbnail: string) => {
    drawer.addItem(keepParams, keepType, thumbnail);
  }, [drawer]);
  
  const handleKeepPlotterToDrawer = useCallback((keepPlotterParams: PlotterParams, keepDrawing: PlotterDrawing, thumbnail: string) => {
    drawer.addPlotterItem(keepPlotterParams, keepDrawing, thumbnail);
  }, [drawer]);
  
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [showWireframe, setShowWireframe] = useState(false);
  const [viewMode, setViewMode] = useState<'model' | 'gcode'>('model');
  const [gcodeLayer, setGcodeLayer] = useState(0);
  const [gcodeShowAll, setGcodeShowAll] = useState(true);
  const [gcodeAnimate, setGcodeAnimate] = useState(false);
  const [materialPreset, setMaterialPreset] = useState<MaterialPreset>('ceramic');
  const [autoRotate, setAutoRotate] = useState(true);
  const [backgroundPreset, setBackgroundPreset] = useState<BackgroundPreset>('minimal');
  const [customColor, setCustomColor] = useState<string | undefined>(undefined);
  const [usePresetColor, setUsePresetColor] = useState(true);
  
  // Leg/base material settings
  const [legMaterialPreset, setLegMaterialPreset] = useState<MaterialPreset>('wood');
  const [legCustomColor, setLegCustomColor] = useState<string | undefined>(undefined);
  const [useLegPresetColor, setUseLegPresetColor] = useState(true);
  const [syncLegMaterial, setSyncLegMaterial] = useState(true);
  
  // Handle successful payment return and load gallery params from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const exportSuccess = urlParams.get('export_success');
    const sessionId = urlParams.get('session_id');
    
    if (exportSuccess === 'true' && sessionId) {
      // Verify payment and trigger download
      const verifyAndDownload = async () => {
        try {
          const { data, error } = await supabase?.functions.invoke('verify-payment', {
            body: { sessionId },
          });
          
          if (error) throw error;
          
          if (data?.verified) {
            toast.success('Payment verified! Your download will start shortly.');
            // Clear URL params
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Payment verification error:', err);
          toast.error('Payment verification failed');
        }
      };
      
      verifyAndDownload();
    }
    
    if (urlParams.get('export_canceled') === 'true') {
      toast.info('Export canceled');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Load gallery design params from URL
    const galleryParams = urlParams.get('params');
    const galleryType = urlParams.get('type') as ObjectType | null;
    if (galleryParams) {
      try {
        const parsedParams = JSON.parse(decodeURIComponent(galleryParams)) as ParametricParams;
        if (galleryType) setObjectType(galleryType);
        setParams(parsedParams);
        toast.success('Gallery design loaded!');
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error('Failed to parse gallery params:', e);
      }
    }
  }, []);

  const handleTypeChange = (type: ObjectType) => {
    setObjectType(type);
    // No need to reset params when switching - we keep the current shape
  };

  const analysis = useMemo((): PrintAnalysis => {
    const baseAnalysis = analyzePrint(params, printSettings);
    
    if (printSettings.printMode === 'non_planar') {
      const nonPlanarAnalysis = analyzeNonPlanarGCode(params, objectType, printSettings);
      
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

  // Actual export functions (called after payment/unlock)
  const doExportBody = useCallback(() => {
    const filename = `${objectType}_body_${params.height}mm_${Date.now()}.stl`;
    downloadBodySTL(params, objectType, filename);
    toast.success('Body STL exported!', { description: filename });
  }, [params, objectType]);

  const doExportLegsBase = useCallback(() => {
    const filename = `${objectType}_legs_base_${Date.now()}.stl`;
    downloadLegsWithBaseSTL(params, filename);
    toast.success('Legs + Base STL exported!', { description: filename });
  }, [params, objectType]);

  const doExportGCode = useCallback(() => {
    const filename = `${objectType}_${params.height}mm_${printSettings.material}.gcode`;
    downloadGCode(params, objectType, printSettings, filename);
    toast.success('G-code exported!', { description: filename });
  }, [params, objectType, printSettings]);

  // Export click handlers that check for payment/license
  const handleExportBody = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    if (isUnlocked) {
      doExportBody();
    } else {
      setPendingExportType('body');
      setShowExportDialog(true);
    }
  }, [analysis.isValid, isUnlocked, doExportBody]);

  const handleExportLegsBase = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    if (isUnlocked) {
      doExportLegsBase();
    } else {
      setPendingExportType('bodyWithLegs');
      setShowExportDialog(true);
    }
  }, [analysis.isValid, isUnlocked, doExportLegsBase]);

  const handleExportAll = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    if (isUnlocked) {
      const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
      downloadAllParts(params, objectType, baseName);
      toast.success('All parts exported!', { 
        description: params.addLegs ? 'Body + Legs/Base' : 'Body only' 
      });
    } else {
      setPendingExportType(params.addLegs ? 'bodyWithLegs' : 'body');
      setShowExportDialog(true);
    }
  }, [params, objectType, analysis.isValid, isUnlocked]);

  const handleExportGCode = useCallback(() => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    
    if (isUnlocked) {
      doExportGCode();
    } else {
      setPendingExportType('gcode');
      setShowExportDialog(true);
    }
  }, [analysis.isValid, isUnlocked, doExportGCode]);

  // Actual mold export function (called after payment/unlock)
  const doExportMold = useCallback((half: 'A' | 'B' | 'both' | number) => {
    const baseName = `${params.shapeStyle}_${params.height}mm_${Date.now()}`;
    const partLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    if (typeof half === 'number') {
      // Multi-part mold specific part
      downloadMultiPartMoldSTL(params, params.shapeStyle, half, baseName);
      toast.success(`Mold Part ${partLabels[half]} exported!`);
    } else if (half === 'both') {
      if (params.moldPartCount > 2) {
        downloadMultiPartMoldSTL(params, params.shapeStyle, 'all', baseName);
        toast.success(`All ${params.moldPartCount} mold parts exported!`);
      } else {
        downloadMoldSTL(params, params.shapeStyle, 'both', baseName);
        toast.success('Both mold halves exported!');
      }
    } else {
      // Single half A or B
      if (params.moldPartCount > 2) {
        downloadMultiPartMoldSTL(params, params.shapeStyle, half === 'A' ? 0 : 1, baseName);
        toast.success(`Mold Part ${half} exported!`);
      } else {
        downloadMoldSTL(params, params.shapeStyle, half, baseName);
        toast.success(`Mold Half ${half} exported!`);
      }
    }
  }, [params]);

  // Actual ZIP export function (called after payment/unlock)
  const doExportAllMoldsZip = useCallback(async () => {
    const zip = new JSZip();
    const baseName = `${objectType}_${params.height}mm_${Date.now()}`;
    const partLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    try {
      toast.info('Generating export package...');

      // Add body STL
      const bodyBlob = await exportBodyToSTL(params, objectType);
      zip.file(`${baseName}_body.stl`, bodyBlob);

      // Add mold parts
      if (params.moldPartCount > 2) {
        const { parts } = generateMultiPartMoldGeometry(params);
        parts.forEach((geo, i) => {
          const stlBlob = exportMoldHalfToSTL(geo);
          zip.file(`${baseName}_mold_${partLabels[i]}.stl`, stlBlob);
          geo.dispose();
        });
      } else {
        const { halfA, halfB } = generateMoldGeometry(params);
        zip.file(`${baseName}_mold_A.stl`, exportMoldHalfToSTL(halfA));
        zip.file(`${baseName}_mold_B.stl`, exportMoldHalfToSTL(halfB));
        halfA.dispose();
        halfB.dispose();
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Download the blob
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_complete.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Complete package exported!', { 
        description: `Body + ${params.moldPartCount > 2 ? params.moldPartCount : 2} mold parts` 
      });
    } catch (error) {
      console.error('Failed to export ZIP:', error);
      toast.error('Export failed');
    }
  }, [params, objectType]);

  // Handle pending export after payment/unlock
  const handlePendingExport = useCallback(() => {
    switch (pendingExportType) {
      case 'body':
        doExportBody();
        break;
      case 'bodyWithLegs':
        doExportLegsBase();
        break;
      case 'gcode':
        doExportGCode();
        break;
      case 'bodyWithMold':
        if (pendingMoldPart !== null) {
          // 'both' triggers the ZIP export with body + all mold parts
          if (pendingMoldPart === 'both') {
            doExportAllMoldsZip();
          } else {
            doExportMold(pendingMoldPart);
          }
        }
        break;
    }
    setPendingMoldPart(null);
  }, [pendingExportType, pendingMoldPart, doExportBody, doExportLegsBase, doExportGCode, doExportMold, doExportAllMoldsZip]);

  // Gated mold export handlers
  const handleExportMoldA = useCallback(() => {
    if (isUnlocked) {
      doExportMold('A');
    } else {
      setPendingExportType('bodyWithMold');
      setPendingMoldPart('A');
      setShowExportDialog(true);
    }
  }, [isUnlocked, doExportMold]);

  const handleExportMoldB = useCallback(() => {
    if (isUnlocked) {
      doExportMold('B');
    } else {
      setPendingExportType('bodyWithMold');
      setPendingMoldPart('B');
      setShowExportDialog(true);
    }
  }, [isUnlocked, doExportMold]);

  const handleExportBothMolds = useCallback(() => {
    if (isUnlocked) {
      doExportMold('both');
    } else {
      setPendingExportType('bodyWithMold');
      setPendingMoldPart('both');
      setShowExportDialog(true);
    }
  }, [isUnlocked, doExportMold]);

  // Export additional mold parts (C, D, etc.) for multi-part molds
  const handleExportMoldPart = useCallback((partIndex: number) => {
    if (isUnlocked) {
      doExportMold(partIndex);
    } else {
      setPendingExportType('bodyWithMold');
      setPendingMoldPart(partIndex);
      setShowExportDialog(true);
    }
  }, [isUnlocked, doExportMold]);

  // Export all molds + body as ZIP (gated)
  const handleExportAllMoldsZip = useCallback(async () => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }

    if (isUnlocked) {
      doExportAllMoldsZip();
    } else {
      setPendingExportType('bodyWithMold');
      setPendingMoldPart('both');
      setShowExportDialog(true);
    }
  }, [analysis.isValid, isUnlocked, doExportAllMoldsZip]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Full bleed viewer - 3D for objects, 2D for plotter */}
      <div className="fixed inset-0 pt-14">
        {objectType === 'plotter' ? (
          <div className="w-full h-full p-8 flex items-center justify-center">
            <div className="w-full max-w-4xl" style={{ height: 'calc(100vh - 10rem)' }}>
              <PlotterPreview 
                drawing={plotterDrawing} 
                margin={plotterParams.marginMm}
              />
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* Left floating panel - Controls */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ 
          x: showLeftPanel ? 0 : -360,
          opacity: showLeftPanel ? 1 : 0 
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed left-4 top-20 bottom-4 w-[340px] z-20 glass-panel overflow-hidden flex flex-col"
      >
        {/* Object Type */}
        <div className="p-4 border-b border-border/50">
          <ObjectTypeTabs activeType={objectType} onTypeChange={handleTypeChange} />
        </div>

        {/* Tabbed Controls - Different for plotter vs 3D */}
        {objectType === 'plotter' ? (
          <Tabs defaultValue="controls" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3 grid grid-cols-2 bg-secondary/50 p-1 rounded-lg">
              <TabsTrigger value="controls" className="text-xs gap-1 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Settings2 className="w-3 h-3" />
                Controls
              </TabsTrigger>
              <TabsTrigger value="drawer" className="text-xs gap-1 relative rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Archive className="w-3 h-3" />
                Drawer
                {drawer.count > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                    {drawer.count}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="p-4 flex-1 overflow-y-auto">
              <TabsContent value="controls" className="mt-0">
                <PlotterControls
                  params={plotterParams}
                  drawing={plotterDrawing}
                  onParamsChange={setPlotterParams}
                  currentMeshParams={params}
                  currentShapeStyle={params.shapeStyle}
                />
              </TabsContent>

              <TabsContent value="drawer" className="mt-0">
                <DrawerPanel
                  items={drawer.items}
                  onLoad={handleLoadFromDrawer}
                  onLoadPlotter={handleLoadPlotterFromDrawer}
                  onRemove={drawer.removeItem}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <Tabs defaultValue="design" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3 grid grid-cols-5 bg-secondary/50 p-1 rounded-lg">
              <TabsTrigger value="design" className="text-xs gap-1 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Layers className="w-3 h-3" />
                Design
              </TabsTrigger>
              <TabsTrigger value="print" className="text-xs gap-1 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Settings2 className="w-3 h-3" />
                Print
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-xs gap-1 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Package className="w-3 h-3" />
                Batch
              </TabsTrigger>
              <TabsTrigger value="presets" className="text-xs rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                Presets
              </TabsTrigger>
              <TabsTrigger value="drawer" className="text-xs gap-1 relative rounded-md data-[state=active]:bg-card data-[state=active]:shadow-soft">
                <Archive className="w-3 h-3" />
                {drawer.count > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                    {drawer.count}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="p-4 flex-1 overflow-y-auto">
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
                  type={params.shapeStyle}
                  currentParams={params}
                  onSelect={setParams}
                />
              </TabsContent>

              <TabsContent value="drawer" className="mt-0">
                <DrawerPanel
                  items={drawer.items}
                  onLoad={handleLoadFromDrawer}
                  onLoadPlotter={handleLoadPlotterFromDrawer}
                  onRemove={drawer.removeItem}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </motion.aside>

      {/* Left panel toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowLeftPanel(!showLeftPanel)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 w-6 h-12 rounded-r-lg bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card"
        style={{ left: showLeftPanel ? '356px' : '4px' }}
      >
        {showLeftPanel ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </Button>

      {/* Bottom floating bar for Plotter mode */}
      {objectType === 'plotter' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-4 left-4 right-4 lg:left-[380px] lg:right-4 z-20 glass-panel px-4 py-3 flex items-center gap-3"
        >
          {/* Keep button for plotter */}
          <PlotterKeepButton
            plotterParams={plotterParams}
            drawing={plotterDrawing}
            onKeep={handleKeepPlotterToDrawer}
          />
          
          <div className="w-px h-6 bg-border/50" />
          
          <span className="text-xs text-muted-foreground">
            Click "Keep" to save this drawing to your drawer for batch export
          </span>
        </motion.div>
      )}

      {/* Bottom floating bar - View controls & Export (hidden for plotter mode) */}
      {objectType !== 'plotter' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-4 left-4 right-4 lg:left-[380px] lg:right-4 z-20 glass-panel px-4 py-3 flex items-center gap-3 overflow-x-auto"
        >
          {/* View mode */}
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
            <Button
              variant={viewMode === 'model' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('model')}
              className="gap-1.5 rounded-md h-8"
            >
              <Eye className="w-3.5 h-3.5" />
              Model
            </Button>
            <Button
              variant={viewMode === 'gcode' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('gcode')}
              className="gap-1.5 rounded-md h-8"
            >
              <FileCode className="w-3.5 h-3.5" />
              G-code
            </Button>
          </div>

          <div className="w-px h-6 bg-border/50" />

          {/* Material & appearance */}
          {viewMode === 'model' && (
            <>
              <Select value={materialPreset} onValueChange={(v) => setMaterialPreset(v as MaterialPreset)}>
                <SelectTrigger className="w-[110px] h-8 text-xs bg-card/50 border-border/50 rounded-lg">
                  <SelectValue placeholder="Material" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-lg">
                  {(Object.keys(MATERIAL_LABELS) as MaterialPreset[]).map((preset) => (
                    <SelectItem key={preset} value={preset} className="text-xs">
                      {MATERIAL_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <input
                type="color"
                value={customColor || MATERIAL_PRESETS[materialPreset as keyof typeof MATERIAL_PRESETS]?.color || '#888888'}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setUsePresetColor(false);
                }}
                className="w-8 h-8 rounded-lg cursor-pointer border border-border/50"
                title="Body color"
              />

              {/* Leg/Base material sync toggle */}
              {params.addLegs && (
                <>
                  <div className="w-px h-6 bg-border/50" />
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={syncLegMaterial}
                      onCheckedChange={setSyncLegMaterial}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Sync</span>
                  </div>

                  {/* Separate leg material controls (when not synced) */}
                  {!syncLegMaterial && (
                    <>
                      <Select value={legMaterialPreset} onValueChange={(v) => setLegMaterialPreset(v as MaterialPreset)}>
                        <SelectTrigger className="w-[90px] h-8 text-xs bg-card/50 border-border/50 rounded-lg">
                          <SelectValue placeholder="Legs" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border rounded-lg">
                          {(Object.keys(MATERIAL_LABELS) as MaterialPreset[]).map((preset) => (
                            <SelectItem key={preset} value={preset} className="text-xs">
                              {MATERIAL_LABELS[preset]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <input
                        type="color"
                        value={legCustomColor || MATERIAL_PRESETS[legMaterialPreset]?.color || '#8B4513'}
                        onChange={(e) => {
                          setLegCustomColor(e.target.value);
                          setUseLegPresetColor(false);
                        }}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-border/50"
                        title="Leg/Base color"
                      />
                    </>
                  )}
                </>
              )}

              <Select value={backgroundPreset} onValueChange={(v) => setBackgroundPreset(v as BackgroundPreset)}>
                <SelectTrigger className="w-[90px] h-8 text-xs bg-card/50 border-border/50 rounded-lg">
                  <Palette className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="BG" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-lg">
                  {(Object.keys(BACKGROUND_PRESETS) as BackgroundPreset[]).map((preset) => (
                    <SelectItem key={preset} value={preset} className="text-xs">
                      {BACKGROUND_PRESETS[preset].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant={autoRotate ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setAutoRotate(!autoRotate)}
                className="h-8 w-8 rounded-lg"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </Button>
              
              <Button
                variant={showWireframe ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowWireframe(!showWireframe)}
                className="h-8 rounded-lg text-xs"
              >
                Wire
              </Button>
            </>
          )}

          {/* G-code controls */}
          {viewMode === 'gcode' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Layer</span>
                <div className="w-32">
                  <Slider
                    value={[gcodeLayer]}
                    min={0}
                    max={totalLayers - 1}
                    step={1}
                    onValueChange={([v]) => setGcodeLayer(v)}
                    disabled={gcodeAnimate}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-16">
                  {gcodeLayer + 1}/{totalLayers}
                </span>
              </div>
              
              <Button
                variant={gcodeAnimate ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setGcodeAnimate(!gcodeAnimate)}
                className="gap-1.5 h-8 rounded-lg"
              >
                {gcodeAnimate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {gcodeAnimate ? 'Pause' : 'Play'}
              </Button>
            </>
          )}

          <div className="w-px h-6 bg-border/50" />

          {/* Keep button - always visible */}
          <KeepButton
            params={params}
            objectType={objectType}
            onKeep={handleKeepToDrawer}
          />
          
          {/* Add to Gallery button */}
          <Button
            onClick={() => setShowGalleryDialog(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 rounded-lg"
            title="Showcase your design in the community gallery"
          >
            <Share2 className="w-3.5 h-3.5" />
            Showcase
          </Button>

          <div className="w-px h-6 bg-border/50" />

          {/* Export buttons */}
          {params.moldEnabled ? (
            <>
              <Button 
                onClick={handleExportBody} 
                disabled={!analysis.isValid}
                variant="secondary"
                size="sm" 
                className="gap-1.5 h-8 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Body
              </Button>
              <Button onClick={handleExportMoldA} size="sm" className="gap-1.5 h-8 rounded-lg">
                <FlaskConical className="w-3.5 h-3.5" />
                Mold A
              </Button>
              <Button onClick={handleExportMoldB} variant="secondary" size="sm" className="gap-1.5 h-8 rounded-lg">
                <FlaskConical className="w-3.5 h-3.5" />
                Mold B
              </Button>
              {/* Dynamic multi-part mold buttons (C, D, E...) */}
              {params.moldPartCount > 2 && (
                <>
                  {Array.from({ length: params.moldPartCount - 2 }, (_, i) => (
                    <Button 
                      key={i + 2}
                      onClick={() => handleExportMoldPart(i + 2)} 
                      variant="secondary" 
                      size="sm"
                      className="gap-1.5 h-8 rounded-lg"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      Mold {String.fromCharCode(67 + i)}
                    </Button>
                  ))}
                </>
              )}
              <Button 
                onClick={handleExportAllMoldsZip} 
                variant="default"
                size="sm"
                className="gap-1.5 h-8 rounded-lg"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                All ZIP
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleExportBody} 
                disabled={!analysis.isValid}
                size="sm"
                className="gap-1.5 h-8 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                STL
              </Button>
              {params.addLegs && (
                <Button 
                  onClick={handleExportLegsBase} 
                  disabled={!analysis.isValid}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 h-8 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Base
                </Button>
              )}
              <Button 
                onClick={handleExportGCode} 
                disabled={!analysis.isValid}
                variant="secondary"
                size="sm"
                className="gap-1.5 h-8 rounded-lg"
              >
                <FileCode className="w-3.5 h-3.5" />
                G-code
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Dimensions overlay - different for plotter vs 3D */}
      <div className="fixed top-20 right-4 z-20 glass-panel px-3 py-2 text-xs font-mono">
        {objectType === 'plotter' ? (
          <div className="text-muted-foreground">
            {plotterParams.orientation === 'landscape' 
              ? `${plotterParams.paperSize.toUpperCase()} Landscape`
              : `${plotterParams.paperSize.toUpperCase()} Portrait`
            }
          </div>
        ) : (
          <>
            <div className="text-muted-foreground">
              {params.height}mm × Ø{params.baseRadius * 2}mm
            </div>
            {params.addLegs && (
              <div className="text-primary/80 mt-0.5">
                + {params.legHeight}mm legs
              </div>
            )}
          </>
        )}
      </div>

      {/* Right panel toggle & Analysis - hidden for plotter mode */}
      {objectType !== 'plotter' && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="fixed right-4 top-32 z-30 w-8 h-8 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card"
          >
            <Info className="w-4 h-4" />
          </Button>

          {/* Right floating panel - Analysis */}
          <motion.aside
            initial={{ x: 20, opacity: 0 }}
            animate={{ 
              x: showRightPanel ? 0 : 320,
              opacity: showRightPanel ? 1 : 0 
            }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-4 top-44 w-[280px] z-20 glass-panel p-4 max-h-[60vh] overflow-y-auto"
          >
            <h2 className="text-xs font-medium text-muted-foreground mb-3">
              Print Analysis
            </h2>
            <PrintAnalysisPanel analysis={analysis} settings={printSettings} />
          </motion.aside>
        </>
      )}

      {/* Export Payment Dialog */}
      <ExportPaymentDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handlePendingExport}
        exportType={pendingExportType}
      />
      
      {/* Add to Gallery Dialog */}
      <AddToGalleryDialog
        open={showGalleryDialog}
        onClose={() => setShowGalleryDialog(false)}
        onSubmit={handleAddToGallery}
        saving={gallery.saving}
      />
    </div>
  );
};

export default Index;
