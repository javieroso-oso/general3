import { useState, useCallback, Suspense } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Eye, EyeOff, Package } from 'lucide-react';
import { toast } from 'sonner';
import { 
  TotemStack, 
  TotemModuleConfig, 
  ModuleType, 
  SpindleSize,
  createModule,
  calculateStackHeight,
  calculateSpindleLength,
  DEFAULT_SHADE_MODULE,
  DEFAULT_SPACER_MODULE,
  DEFAULT_BASE_MODULE,
  DEFAULT_CAP_MODULE,
  DEFAULT_PENDANT_MODULE,
} from '@/types/totem';
import TotemStackPreview from '@/components/3d/TotemStackPreview';
import ModulePalette from '@/components/totem/ModulePalette';
import StackList from '@/components/totem/StackList';
import ModuleEditor from '@/components/totem/ModuleEditor';
import StackInfo from '@/components/totem/StackInfo';
import { downloadTotemModuleSTL, downloadTotemPackage } from '@/lib/totem/stl-export';

// Default module configurations by type
const getDefaultModuleConfig = (type: ModuleType) => {
  switch (type) {
    case 'shade':
      return DEFAULT_SHADE_MODULE;
    case 'extension':
      return { ...DEFAULT_SHADE_MODULE, type: 'extension' as const };
    case 'spacer':
      return DEFAULT_SPACER_MODULE;
    case 'base':
      return DEFAULT_BASE_MODULE;
    case 'cap':
      return DEFAULT_CAP_MODULE;
    case 'pendant':
      return DEFAULT_PENDANT_MODULE;
    default:
      return DEFAULT_SHADE_MODULE;
  }
};

const TotemBuilder = () => {
  const [stack, setStack] = useState<TotemStack>({
    id: `stack_${Date.now()}`,
    name: 'New Totem',
    spindleSize: 'standard',
    modules: [],
    totalHeight: 0,
    spindleLength: 0,
  });
  const [selectedModuleId, setSelectedModuleId] = useState<string | undefined>();
  const [showSpindle, setShowSpindle] = useState(true);

  // Get selected module
  const selectedModule = stack.modules.find(m => m.id === selectedModuleId) || null;

  // Recalculate stack properties
  const updateStackCalculations = useCallback((modules: TotemModuleConfig[]) => {
    return {
      totalHeight: calculateStackHeight(modules),
      spindleLength: calculateSpindleLength(modules),
    };
  }, []);

  // Add a new module
  const handleAddModule = useCallback((type: ModuleType) => {
    const defaultConfig = getDefaultModuleConfig(type);
    const moduleName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${stack.modules.filter(m => m.type === type).length + 1}`;
    const newModule = createModule(defaultConfig as any, moduleName);
    
    const newModules = [...stack.modules, newModule];
    const calculations = updateStackCalculations(newModules);
    
    setStack(prev => ({
      ...prev,
      modules: newModules,
      ...calculations,
    }));
    setSelectedModuleId(newModule.id);
    toast.success(`Added ${type} module`);
  }, [stack.modules, updateStackCalculations]);

  // Remove a module
  const handleRemoveModule = useCallback((id: string) => {
    const newModules = stack.modules.filter(m => m.id !== id);
    const calculations = updateStackCalculations(newModules);
    
    setStack(prev => ({
      ...prev,
      modules: newModules,
      ...calculations,
    }));
    if (selectedModuleId === id) {
      setSelectedModuleId(undefined);
    }
    toast.success('Module removed');
  }, [stack.modules, selectedModuleId, updateStackCalculations]);

  // Move a module up or down in the stack
  const handleMoveModule = useCallback((id: string, direction: 'up' | 'down') => {
    setStack(prev => {
      const index = prev.modules.findIndex(m => m.id === id);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index + 1 : index - 1;
      if (newIndex < 0 || newIndex >= prev.modules.length) return prev;
      
      const newModules = [...prev.modules];
      [newModules[index], newModules[newIndex]] = [newModules[newIndex], newModules[index]];
      
      return { ...prev, modules: newModules };
    });
  }, []);

  // Update a module's properties
  const handleUpdateModule = useCallback((id: string, updates: Partial<TotemModuleConfig>) => {
    setStack(prev => {
      const newModules = prev.modules.map(m => 
        m.id === id ? { ...m, ...updates } as TotemModuleConfig : m
      );
      const calculations = updateStackCalculations(newModules);
      
      return {
        ...prev,
        modules: newModules,
        ...calculations,
      };
    });
  }, [updateStackCalculations]);

  // Change spindle size
  const handleSpindleSizeChange = useCallback((size: string) => {
    const spindleSize = size as SpindleSize;
    setStack(prev => ({
      ...prev,
      spindleSize,
      modules: prev.modules.map(m => ({
        ...m,
        spindleSize,
      })),
    }));
    toast.success(`Spindle size changed to ${spindleSize}`);
  }, []);

  // Export selected module
  const handleExportSelected = useCallback(() => {
    if (!selectedModule) {
      toast.error('No module selected');
      return;
    }
    downloadTotemModuleSTL(selectedModule);
    toast.success('STL downloaded');
  }, [selectedModule]);

  // Export all modules
  const handleExportAll = useCallback(() => {
    if (stack.modules.length === 0) {
      toast.error('No modules to export');
      return;
    }
    downloadTotemPackage(stack);
    toast.success('Downloading all modules + assembly guide');
  }, [stack]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wider">Totem Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create modular lamp stacks with interchangeable components
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Spindle Size */}
            <div className="p-4 bg-card border-2 border-border rounded-lg">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Spindle Size
              </Label>
              <Select 
                value={stack.spindleSize} 
                onValueChange={handleSpindleSizeChange}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">8mm Dowel (Small)</SelectItem>
                  <SelectItem value="standard">10mm Dowel (Standard)</SelectItem>
                  <SelectItem value="large">12mm Dowel (Large)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module Palette */}
            <div className="p-4 bg-card border-2 border-border rounded-lg">
              <ModulePalette onAddModule={handleAddModule} />
            </div>

            {/* Stack List */}
            <div className="p-4 bg-card border-2 border-border rounded-lg">
              <StackList
                modules={stack.modules}
                selectedModuleId={selectedModuleId}
                onSelectModule={setSelectedModuleId}
                onRemoveModule={handleRemoveModule}
                onMoveModule={handleMoveModule}
              />
            </div>

            {/* Module Editor */}
            <div className="p-4 bg-card border-2 border-border rounded-lg">
              <ModuleEditor
                module={selectedModule}
                onUpdateModule={handleUpdateModule}
              />
            </div>

            {/* Stack Info */}
            <div className="p-4 bg-card border-2 border-border rounded-lg">
              <StackInfo stack={stack} />
            </div>
          </div>

          {/* Right Panel - 3D Preview */}
          <div className="lg:col-span-8 space-y-4">
            {/* Preview Controls */}
            <div className="flex items-center justify-between p-4 bg-card border-2 border-border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-spindle"
                    checked={showSpindle}
                    onCheckedChange={setShowSpindle}
                  />
                  <Label htmlFor="show-spindle" className="text-sm flex items-center gap-1">
                    {showSpindle ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>Spindle</span>
                  </Label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSelected}
                  disabled={!selectedModule}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export Selected
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportAll}
                  disabled={stack.modules.length === 0}
                >
                  <Package className="w-4 h-4 mr-1" />
                  Export All
                </Button>
              </div>
            </div>

            {/* 3D Preview */}
            <div className="h-[600px] border-2 border-border rounded-lg overflow-hidden">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                  <span className="text-muted-foreground">Loading 3D preview...</span>
                </div>
              }>
                <TotemStackPreview
                  stack={stack}
                  selectedModuleId={selectedModuleId}
                  onSelectModule={setSelectedModuleId}
                  showSpindle={showSpindle}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TotemBuilder;
