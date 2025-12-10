import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import Scene3D from '@/components/3d/Scene3D';
import ParameterControls from '@/components/controls/ParameterControls';
import PresetGallery from '@/components/controls/PresetGallery';
import ObjectTypeTabs from '@/components/controls/ObjectTypeTabs';
import PrintAnalysisPanel from '@/components/controls/PrintAnalysisPanel';
import PrintSettingsPanel from '@/components/controls/PrintSettingsPanel';
import BatchGenerator from '@/components/controls/BatchGenerator';
import { 
  ParametricParams, 
  ObjectType, 
  defaultParams, 
  PrintSettings, 
  defaultPrintSettings,
  analyzePrint 
} from '@/types/parametric';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers, Package, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Index = () => {
  const [objectType, setObjectType] = useState<ObjectType>('vase');
  const [params, setParams] = useState<ParametricParams>(defaultParams.vase);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [showWireframe, setShowWireframe] = useState(false);

  const handleTypeChange = (type: ObjectType) => {
    setObjectType(type);
    setParams(defaultParams[type]);
  };

  const analysis = useMemo(() => 
    analyzePrint(params, printSettings), 
    [params, printSettings]
  );

  const handleExportSTL = () => {
    if (!analysis.isValid) {
      toast.error('Fix print issues before exporting');
      return;
    }
    toast.success('STL export ready', {
      description: 'File generation in progress...',
    });
  };

  return (
    <Layout showFooter={false}>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Left Panel - Controls */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[380px] xl:w-[420px] border-r border-border bg-card flex flex-col"
        >
          {/* Object Type */}
          <div className="p-4 border-b border-border">
            <ObjectTypeTabs activeType={objectType} onTypeChange={handleTypeChange} />
          </div>

          {/* Tabbed Controls */}
          <Tabs defaultValue="design" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4 grid grid-cols-4">
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
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
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
            </div>
          </Tabs>
        </motion.aside>

        {/* Center - 3D Viewer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4 bg-background flex flex-col"
        >
          <div className="flex-1 glass-panel-elevated overflow-hidden relative">
            <Scene3D params={params} type={objectType} showWireframe={showWireframe} />
            
            {/* Overlay controls */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <Button
                variant={showWireframe ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowWireframe(!showWireframe)}
              >
                Wireframe
              </Button>
            </div>
            
            {/* Dimensions display */}
            <div className="absolute top-4 left-4 bg-card/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-mono">
              <div className="text-text-muted">
                {params.height}mm × Ø{params.baseRadius * 2}mm
              </div>
            </div>
          </div>

          {/* Export button */}
          <div className="mt-4">
            <Button 
              onClick={handleExportSTL} 
              disabled={!analysis.isValid}
              className="w-full gap-2"
              size="lg"
            >
              <Download className="w-5 h-5" />
              Export STL for Printing
            </Button>
          </div>
        </motion.div>

        {/* Right Panel - Print Analysis */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:block w-[320px] border-l border-border bg-card overflow-y-auto p-4"
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
