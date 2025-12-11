import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, AlertTriangle, CheckCircle, Pen, Image, RotateCcw, ArrowRight, Spline } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/layout/Layout';
import ProfileCanvas from '@/components/drawing/ProfileCanvas';
import ImageProcessor from '@/components/drawing/ImageProcessor';
import ProfileMesh from '@/components/3d/ProfileMesh';
import { ProfilePoint, ProfileSettings, defaultProfileSettings, validateProfile, GenerationMode } from '@/types/custom-profile';
import { defaultPrintSettings, PrintSettings } from '@/types/parametric';
import { downloadProfileSTL, downloadProfileGCode } from '@/lib/profile-to-mesh';

const CustomGenerator = () => {
  const [profile, setProfile] = useState<ProfilePoint[]>([]);
  const [settings, setSettings] = useState<ProfileSettings>(defaultProfileSettings);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [wireframe, setWireframe] = useState(false);
  const [activeTab, setActiveTab] = useState<'draw' | 'image'>('draw');

  const validation = validateProfile(profile, settings);

  const handleExportSTL = () => {
    if (!validation.isValid || profile.length < 2) {
      toast.error('Please create a valid profile first');
      return;
    }
    downloadProfileSTL(profile, settings, 'custom-profile.stl');
    toast.success('STL exported successfully');
  };

  const handleExportGCode = () => {
    if (!validation.isValid || profile.length < 2) {
      toast.error('Please create a valid profile first');
      return;
    }
    downloadProfileGCode(profile, settings, printSettings, 'custom-profile.gcode');
    toast.success('G-code exported successfully');
  };

  const handleModeChange = (mode: GenerationMode) => {
    setSettings({ ...settings, generationMode: mode });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Custom Shape Generator</h1>
          <p className="text-muted-foreground">
            Draw a profile or upload an image to create a 3D printable object
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Drawing/Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'draw' | 'image')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="draw" className="flex items-center gap-2">
                      <Pen className="w-4 h-4" />
                      Draw Profile
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      From Image
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {activeTab === 'draw' ? (
                  <ProfileCanvas onProfileChange={setProfile} />
                ) : (
                  <ImageProcessor onProfileChange={setProfile} />
                )}
              </CardContent>
            </Card>

            {/* Generation Mode */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Generation Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={settings.generationMode}
                  onValueChange={(v) => handleModeChange(v as GenerationMode)}
                  className="grid grid-cols-3 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lathe" id="lathe" />
                    <Label htmlFor="lathe" className="flex items-center gap-2 cursor-pointer">
                      <RotateCcw className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Lathe</div>
                        <div className="text-xs text-muted-foreground">Revolve around axis</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="extrude" id="extrude" />
                    <Label htmlFor="extrude" className="flex items-center gap-2 cursor-pointer">
                      <ArrowRight className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Extrude</div>
                        <div className="text-xs text-muted-foreground">Push straight out</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="path" id="path" />
                    <Label htmlFor="path" className="flex items-center gap-2 cursor-pointer">
                      <Spline className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Path</div>
                        <div className="text-xs text-muted-foreground">Shape follows line</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Profile Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Common Settings */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Smoothing</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(settings.smoothing * 100)}%</span>
                  </div>
                  <Slider
                    value={[settings.smoothing]}
                    onValueChange={([v]) => setSettings({ ...settings, smoothing: v })}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>

                {/* Lathe-specific settings */}
                {settings.generationMode === 'lathe' && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Wall Thickness</Label>
                        <span className="text-sm text-muted-foreground">{settings.wallThickness}mm</span>
                      </div>
                      <Slider
                        value={[settings.wallThickness]}
                        onValueChange={([v]) => setSettings({ ...settings, wallThickness: v })}
                        min={1}
                        max={10}
                        step={0.5}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Segments</Label>
                        <span className="text-sm text-muted-foreground">{settings.segments}</span>
                      </div>
                      <Slider
                        value={[settings.segments]}
                        onValueChange={([v]) => setSettings({ ...settings, segments: v })}
                        min={16}
                        max={128}
                        step={8}
                      />
                    </div>
                  </>
                )}

                {/* Extrude-specific settings */}
                {settings.generationMode === 'extrude' && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Extrusion Depth</Label>
                      <span className="text-sm text-muted-foreground">{settings.extrusionDepth}mm</span>
                    </div>
                    <Slider
                      value={[settings.extrusionDepth]}
                      onValueChange={([v]) => setSettings({ ...settings, extrusionDepth: v })}
                      min={5}
                      max={100}
                      step={5}
                    />
                  </div>
                )}

                {/* Path-specific settings */}
                {settings.generationMode === 'path' && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Cross-Section Size</Label>
                        <span className="text-sm text-muted-foreground">{settings.crossSectionSize}mm</span>
                      </div>
                      <Slider
                        value={[settings.crossSectionSize]}
                        onValueChange={([v]) => setSettings({ ...settings, crossSectionSize: v })}
                        min={2}
                        max={30}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cross-Section Shape</Label>
                      <RadioGroup
                        value={settings.pathCrossSection}
                        onValueChange={(v) => setSettings({ ...settings, pathCrossSection: v as 'circle' | 'square' })}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="circle" id="circle" />
                          <Label htmlFor="circle" className="cursor-pointer">Circle</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="square" id="square" />
                          <Label htmlFor="square" className="cursor-pointer">Square</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Label>Wireframe Preview</Label>
                  <Switch checked={wireframe} onCheckedChange={setWireframe} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Panel - 3D Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <Card className="h-[500px]">
              <CardContent className="p-0 h-full">
                <Canvas camera={{ position: [3, 2, 3], fov: 50 }}>
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[10, 10, 5]} intensity={1} />
                  <Suspense fallback={null}>
                    <ProfileMesh 
                      profile={profile} 
                      settings={settings} 
                      wireframe={wireframe}
                    />
                    <Grid
                      args={[10, 10]}
                      cellSize={0.5}
                      cellThickness={0.5}
                      cellColor="#6e6e6e"
                      sectionSize={2}
                      sectionThickness={1}
                      sectionColor="#9d4b4b"
                      fadeDistance={25}
                      fadeStrength={1}
                      position={[0, -0.5, 0]}
                    />
                    <Environment preset="studio" />
                  </Suspense>
                  <OrbitControls makeDefault />
                </Canvas>
              </CardContent>
            </Card>

            {/* Validation Status */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-4">
                  {validation.isValid && profile.length >= 2 ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-600">Ready to print</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <span className="font-medium text-amber-600">
                        {profile.length < 2 ? 'Draw a profile to begin' : 'Issues detected'}
                      </span>
                    </>
                  )}
                </div>

                {profile.length >= 2 && (
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Mode:</span>
                      <span className="ml-2 font-medium capitalize">{settings.generationMode}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Height:</span>
                      <span className="ml-2 font-medium">{validation.height.toFixed(1)}mm</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Radius:</span>
                      <span className="ml-2 font-medium">{validation.maxRadius.toFixed(1)}mm</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Points:</span>
                      <span className="ml-2 font-medium">{profile.length}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Est. Volume:</span>
                      <span className="ml-2 font-medium">{(validation.estimatedVolume / 1000).toFixed(1)}cm³</span>
                    </div>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {validation.warnings.map((warning, i) => (
                      <div
                        key={i}
                        className={`text-xs px-3 py-2 rounded ${
                          warning.type === 'error'
                            ? 'bg-red-500/10 text-red-600'
                            : warning.type === 'warning'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}
                      >
                        {warning.message}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleExportSTL}
                    disabled={!validation.isValid || profile.length < 2}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export STL
                  </Button>
                  <Button
                    onClick={handleExportGCode}
                    disabled={!validation.isValid || profile.length < 2}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export G-code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomGenerator;