import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Download, Shuffle, FileCode, FileImage, Camera, RotateCcw, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  PlotterParams, 
  PAPER_SIZES, 
  GenerativePattern, 
  PLOTTER_MACHINES,
  PlotterMode,
  ProjectionType,
  LineFieldMode,
  LineFieldGeometry,
  CapturedMeshParams,
  PlotterPreviewColors,
  PAPER_PRESETS,
} from '@/types/plotter';
import { PlotterDrawing } from '@/types/plotter';
import { ParametricParams } from '@/types/parametric';
import { downloadSVG, downloadPlotterGCode, downloadHPGL } from '@/lib/plotter/export';

interface PlotterControlsProps {
  params: PlotterParams;
  drawing: PlotterDrawing | null;
  onParamsChange: (params: PlotterParams) => void;
  // For 3D projection mode - live params (always synced)
  currentMeshParams?: ParametricParams;
  currentShapeStyle?: string;
}

const PATTERN_LABELS: Record<GenerativePattern, string> = {
  flowField: 'Flow Field',
  particles: 'Particles',
  spiral: 'Spiral',
  lissajous: 'Lissajous',
  waveFunctions: 'Waves',
  concentricCircles: 'Concentric',
  voronoi: 'Voronoi',
};

const PROJECTION_TYPE_LABELS: Record<ProjectionType, string> = {
  crossSection: 'Cross-Section Slices',
  silhouette: 'Silhouette Outline',
  contourStack: 'Contour Stack',
  lineField: 'Distortion Field',
  contourLines: 'Contour Lines',
  exploded: 'Exploded View',
};

const LINE_FIELD_MODE_LABELS: Record<LineFieldMode, { label: string; description: string }> = {
  around: { label: 'Around', description: 'Lines flow around the shape' },
  through: { label: 'Through', description: 'Lines distort through center' },
  outline: { label: 'Outline', description: 'Lines trace the edge' },
};

const LINE_FIELD_GEOMETRY_LABELS: Record<LineFieldGeometry, { label: string; description: string }> = {
  parallel: { label: 'Parallel', description: 'Straight parallel lines' },
  radial: { label: 'Radial', description: 'Lines emanate from center' },
};

const PlotterControls = ({ 
  params, 
  drawing, 
  onParamsChange,
  currentMeshParams,
  currentShapeStyle,
}: PlotterControlsProps) => {
  const updateParams = useCallback(<K extends keyof PlotterParams>(
    key: K, 
    value: PlotterParams[K]
  ) => {
    onParamsChange({ ...params, [key]: value });
  }, [params, onParamsChange]);

  const updateFlowField = useCallback(<K extends keyof typeof params.flowField>(
    key: K,
    value: typeof params.flowField[K]
  ) => {
    onParamsChange({
      ...params,
      flowField: { ...params.flowField, [key]: value },
    });
  }, [params, onParamsChange]);

  const updateSpiral = useCallback(<K extends keyof typeof params.spiral>(
    key: K,
    value: typeof params.spiral[K]
  ) => {
    onParamsChange({
      ...params,
      spiral: { ...params.spiral, [key]: value },
    });
  }, [params, onParamsChange]);

  const updateLissajous = useCallback(<K extends keyof typeof params.lissajous>(
    key: K,
    value: typeof params.lissajous[K]
  ) => {
    onParamsChange({
      ...params,
      lissajous: { ...params.lissajous, [key]: value },
    });
  }, [params, onParamsChange]);

  const updateWave = useCallback(<K extends keyof typeof params.wave>(
    key: K,
    value: typeof params.wave[K]
  ) => {
    onParamsChange({
      ...params,
      wave: { ...params.wave, [key]: value },
    });
  }, [params, onParamsChange]);

  const updateProjection = useCallback(<K extends keyof typeof params.projection>(
    key: K,
    value: typeof params.projection[K]
  ) => {
    onParamsChange({
      ...params,
      projection: { ...params.projection, [key]: value },
    });
  }, [params, onParamsChange]);

  const randomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 10000);
    onParamsChange({
      ...params,
      flowField: { ...params.flowField, seed: newSeed },
      spiral: { ...params.spiral, seed: newSeed },
      particles: { ...params.particles, seed: newSeed },
    });
  }, [params, onParamsChange]);

  const captureCurrentDesign = useCallback(() => {
    if (!currentMeshParams || !currentShapeStyle) {
      return;
    }
    
    const captured: CapturedMeshParams = {
      params: currentMeshParams as unknown as Record<string, unknown>,
      objectType: currentShapeStyle,
      capturedAt: Date.now(),
    };
    
    onParamsChange({
      ...params,
      capturedMesh: captured,
      mode: 'projection',
    });
  }, [params, onParamsChange, currentMeshParams, currentShapeStyle]);

  const handleModeChange = useCallback((mode: PlotterMode) => {
    // When switching to projection mode, auto-capture if no design captured
    if (mode === 'projection' && !params.capturedMesh && currentMeshParams && currentShapeStyle) {
      const captured: CapturedMeshParams = {
        params: currentMeshParams as unknown as Record<string, unknown>,
        objectType: currentShapeStyle,
        capturedAt: Date.now(),
      };
      onParamsChange({
        ...params,
        mode,
        capturedMesh: captured,
      });
    } else {
      updateParams('mode', mode);
    }
  }, [params, onParamsChange, updateParams, currentMeshParams, currentShapeStyle]);

  const handleExportSVG = useCallback(() => {
    if (!drawing) return;
    const modeLabel = params.mode === 'projection' ? 'projection' : params.pattern;
    const filename = `plotter_${modeLabel}_${Date.now()}.svg`;
    downloadSVG(drawing, filename);
  }, [drawing, params.mode, params.pattern]);

  const handleExportGCode = useCallback(() => {
    if (!drawing) return;
    const modeLabel = params.mode === 'projection' ? 'projection' : params.pattern;
    const filename = `plotter_${modeLabel}_${Date.now()}.gcode`;
    downloadPlotterGCode(drawing, params.machinePreset, filename);
  }, [drawing, params.mode, params.pattern, params.machinePreset]);

  const handleExportHPGL = useCallback(() => {
    if (!drawing) return;
    const modeLabel = params.mode === 'projection' ? 'projection' : params.pattern;
    const filename = `plotter_${modeLabel}_${Date.now()}.hpgl`;
    downloadHPGL(drawing, filename);
  }, [drawing, params.mode, params.pattern]);

  const hasCapturedDesign = !!params.capturedMesh;
  const capturedType = params.capturedMesh?.objectType;

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Mode</Label>
        <Tabs value={params.mode} onValueChange={(v) => handleModeChange(v as PlotterMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generative" className="text-xs">Generative</TabsTrigger>
            <TabsTrigger value="projection" className="text-xs">3D Projection</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Paper Settings */}
      <Accordion type="single" collapsible defaultValue="paper">
        <AccordionItem value="paper" className="border-none">
          <AccordionTrigger className="py-2 text-sm font-medium">
            Paper Settings
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Size</Label>
                <Select
                  value={params.paperSize}
                  onValueChange={(v) => updateParams('paperSize', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAPER_SIZES).map(([key, size]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {size.name} ({size.width}×{size.height}mm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Orientation</Label>
                <Select
                  value={params.orientation}
                  onValueChange={(v) => updateParams('orientation', v as 'portrait' | 'landscape')}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait" className="text-xs">Portrait</SelectItem>
                    <SelectItem value="landscape" className="text-xs">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">
                Margin: {params.marginMm}mm
              </Label>
              <Slider
                value={[params.marginMm]}
                min={5}
                max={30}
                step={1}
                onValueChange={([v]) => updateParams('marginMm', v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Generative Mode Controls */}
      {params.mode === 'generative' && (
        <>
          {/* Pattern Selection */}
          <Accordion type="single" collapsible defaultValue="pattern">
            <AccordionItem value="pattern" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium">
                Pattern
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-1">
                  {(['flowField', 'spiral', 'lissajous', 'waveFunctions', 'concentricCircles'] as GenerativePattern[]).map((pattern) => (
                    <Button
                      key={pattern}
                      variant={params.pattern === pattern ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateParams('pattern', pattern)}
                      className="text-xs h-8"
                    >
                      {PATTERN_LABELS[pattern]}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={randomizeSeed}
                  className="w-full gap-2"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Randomize
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Pattern-specific controls */}
          {params.pattern === 'flowField' && (
            <Accordion type="single" collapsible defaultValue="flowField">
              <AccordionItem value="flowField" className="border-none">
                <AccordionTrigger className="py-2 text-sm font-medium">
                  Flow Field Settings
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Noise Scale: {params.flowField.noiseScale.toFixed(3)}
                    </Label>
                    <Slider
                      value={[params.flowField.noiseScale * 1000]}
                      min={1}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateFlowField('noiseScale', v / 1000)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Line Count: {params.flowField.particleCount}
                    </Label>
                    <Slider
                      value={[params.flowField.particleCount]}
                      min={20}
                      max={500}
                      step={10}
                      onValueChange={([v]) => updateFlowField('particleCount', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Line Length: {params.flowField.lineLength}
                    </Label>
                    <Slider
                      value={[params.flowField.lineLength]}
                      min={10}
                      max={300}
                      step={5}
                      onValueChange={([v]) => updateFlowField('lineLength', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Curvature: {params.flowField.curvature.toFixed(1)}
                    </Label>
                    <Slider
                      value={[params.flowField.curvature * 10]}
                      min={1}
                      max={30}
                      step={1}
                      onValueChange={([v]) => updateFlowField('curvature', v / 10)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {(params.pattern === 'spiral' || params.pattern === 'concentricCircles') && (
            <Accordion type="single" collapsible defaultValue="spiral">
              <AccordionItem value="spiral" className="border-none">
                <AccordionTrigger className="py-2 text-sm font-medium">
                  {params.pattern === 'concentricCircles' ? 'Circle Settings' : 'Spiral Settings'}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {params.pattern === 'concentricCircles' ? 'Ring Count' : 'Turns'}: {params.spiral.turns}
                    </Label>
                    <Slider
                      value={[params.spiral.turns]}
                      min={3}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateSpiral('turns', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Spacing: {params.spiral.spacing}mm
                    </Label>
                    <Slider
                      value={[params.spiral.spacing]}
                      min={1}
                      max={20}
                      step={0.5}
                      onValueChange={([v]) => updateSpiral('spacing', v)}
                    />
                  </div>
                  {params.pattern === 'spiral' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Variation: {(params.spiral.variation * 100).toFixed(0)}%
                      </Label>
                      <Slider
                        value={[params.spiral.variation * 100]}
                        min={0}
                        max={50}
                        step={1}
                        onValueChange={([v]) => updateSpiral('variation', v / 100)}
                      />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {params.pattern === 'lissajous' && (
            <Accordion type="single" collapsible defaultValue="lissajous">
              <AccordionItem value="lissajous" className="border-none">
                <AccordionTrigger className="py-2 text-sm font-medium">
                  Lissajous Settings
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Freq X: {params.lissajous.freqX}
                      </Label>
                      <Slider
                        value={[params.lissajous.freqX]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={([v]) => updateLissajous('freqX', v)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Freq Y: {params.lissajous.freqY}
                      </Label>
                      <Slider
                        value={[params.lissajous.freqY]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={([v]) => updateLissajous('freqY', v)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Phase: {(params.lissajous.phaseY * 180 / Math.PI).toFixed(0)}°
                    </Label>
                    <Slider
                      value={[params.lissajous.phaseY * 180 / Math.PI]}
                      min={0}
                      max={360}
                      step={5}
                      onValueChange={([v]) => updateLissajous('phaseY', v * Math.PI / 180)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Points: {params.lissajous.points}
                    </Label>
                    <Slider
                      value={[params.lissajous.points]}
                      min={100}
                      max={5000}
                      step={100}
                      onValueChange={([v]) => updateLissajous('points', v)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {params.pattern === 'waveFunctions' && (
            <Accordion type="single" collapsible defaultValue="wave">
              <AccordionItem value="wave" className="border-none">
                <AccordionTrigger className="py-2 text-sm font-medium">
                  Wave Settings
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Wave Count: {params.wave.waveCount}
                    </Label>
                    <Slider
                      value={[params.wave.waveCount]}
                      min={5}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateWave('waveCount', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Frequency: {params.wave.frequency.toFixed(2)}
                    </Label>
                    <Slider
                      value={[params.wave.frequency * 100]}
                      min={1}
                      max={20}
                      step={1}
                      onValueChange={([v]) => updateWave('frequency', v / 100)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Amplitude: {params.wave.amplitude}
                    </Label>
                    <Slider
                      value={[params.wave.amplitude]}
                      min={5}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateWave('amplitude', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Phase Offset: {params.wave.phaseOffset.toFixed(2)}
                    </Label>
                    <Slider
                      value={[params.wave.phaseOffset * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => updateWave('phaseOffset', v / 100)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </>
      )}

      {/* 3D Projection Mode Controls */}
      {params.mode === 'projection' && (
        <>
          {/* Design Capture */}
          <Accordion type="single" collapsible defaultValue="capture">
            <AccordionItem value="capture" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium">
                Source Design
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {hasCapturedDesign ? (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize">{capturedType} Design</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(params.capturedMesh!.capturedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={captureCurrentDesign}
                      disabled={!currentMeshParams || !currentShapeStyle}
                      className="w-full gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Recapture Current Design
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No design captured. Design your shape first, then switch to Plotter mode - it will auto-capture.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={captureCurrentDesign}
                      disabled={!currentMeshParams || !currentShapeStyle}
                      className="w-full gap-2"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture Current Design
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Projection Settings */}
          <Accordion type="single" collapsible defaultValue="projection">
            <AccordionItem value="projection" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium">
                Projection Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Projection Type</Label>
                  <Select
                    value={params.projection.type}
                    onValueChange={(v) => updateProjection('type', v as ProjectionType)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROJECTION_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Slice Count: {params.projection.sliceCount}
                  </Label>
                  <Slider
                    value={[params.projection.sliceCount]}
                    min={5}
                    max={50}
                    step={1}
                    onValueChange={([v]) => updateProjection('sliceCount', v)}
                  />
                </div>

                {params.projection.type === 'contourStack' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Slice Spacing: {params.projection.sliceSpacing}mm
                    </Label>
                    <Slider
                      value={[params.projection.sliceSpacing]}
                      min={0}
                      max={20}
                      step={0.5}
                      onValueChange={([v]) => updateProjection('sliceSpacing', v)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Rotate X: {(params.projection.viewAngle.x * 180 / Math.PI).toFixed(0)}°
                    </Label>
                    <Slider
                      value={[params.projection.viewAngle.x * 180 / Math.PI]}
                      min={-90}
                      max={90}
                      step={5}
                      onValueChange={([v]) => updateProjection('viewAngle', { 
                        ...params.projection.viewAngle, 
                        x: v * Math.PI / 180 
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Rotate Y: {(params.projection.viewAngle.y * 180 / Math.PI).toFixed(0)}°
                    </Label>
                    <Slider
                      value={[params.projection.viewAngle.y * 180 / Math.PI]}
                      min={-180}
                      max={180}
                      step={5}
                      onValueChange={([v]) => updateProjection('viewAngle', { 
                        ...params.projection.viewAngle, 
                        y: v * Math.PI / 180 
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Scale: {(params.projection.scale * 100).toFixed(0)}%
                  </Label>
                  <Slider
                    value={[params.projection.scale * 100]}
                    min={25}
                    max={150}
                    step={5}
                    onValueChange={([v]) => updateProjection('scale', v / 100)}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Line Detail: {params.projection.lineDetail} segments
                  </Label>
                  <Slider
                    value={[params.projection.lineDetail]}
                    min={32}
                    max={128}
                    step={8}
                    onValueChange={([v]) => updateProjection('lineDetail', v)}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Stroke Weight: {params.projection.strokeWeight.toFixed(2)}mm
                  </Label>
                  <Slider
                    value={[params.projection.strokeWeight * 100]}
                    min={10}
                    max={100}
                    step={5}
                    onValueChange={([v]) => updateProjection('strokeWeight', v / 100)}
                  />
                </div>

                {params.projection.type === 'contourStack' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Perspective: {(params.projection.perspective * 100).toFixed(0)}%
                    </Label>
                    <Slider
                      value={[params.projection.perspective * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => updateProjection('perspective', v / 100)}
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Simplify: {params.projection.simplifyTolerance.toFixed(1)}
                  </Label>
                  <Slider
                    value={[params.projection.simplifyTolerance * 10]}
                    min={0}
                    max={30}
                    step={1}
                    onValueChange={([v]) => updateProjection('simplifyTolerance', v / 10)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Offset X: {params.projection.centerOffset.x.toFixed(0)}mm
                    </Label>
                    <Slider
                      value={[params.projection.centerOffset.x]}
                      min={-50}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateProjection('centerOffset', {
                        ...params.projection.centerOffset,
                        x: v
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Offset Y: {params.projection.centerOffset.y.toFixed(0)}mm
                    </Label>
                    <Slider
                      value={[params.projection.centerOffset.y]}
                      min={-50}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateProjection('centerOffset', {
                        ...params.projection.centerOffset,
                        y: v
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show Hidden Lines</Label>
                  <Switch
                    checked={params.projection.showHiddenLines}
                    onCheckedChange={(v) => updateProjection('showHiddenLines', v)}
                  />
                </div>

                {/* Contour Lines Settings */}
                {params.projection.type === 'contourLines' && (
                  <>
                    <div className="border-t border-border pt-3 mt-3">
                      <Label className="text-xs font-medium text-foreground mb-2 block">Contour Lines</Label>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Line Count: {params.projection.lineFieldCount ?? 40}
                      </Label>
                      <Slider
                        value={[params.projection.lineFieldCount ?? 40]}
                        min={10}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateProjection('lineFieldCount', v)}
                      />
                    </div>

                    {/* Light Pass-Through Toggle */}
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Light Pass-Through</Label>
                        <p className="text-[10px] text-muted-foreground/70">Break lines inside shape</p>
                      </div>
                      <Switch
                        checked={params.projection.lineFieldBreakInside ?? false}
                        onCheckedChange={(v) => updateProjection('lineFieldBreakInside', v)}
                      />
                    </div>
                  </>
                )}

                {/* Line Field Settings */}
                {params.projection.type === 'lineField' && (
                  <>
                    <div className="border-t border-border pt-3 mt-3">
                      <Label className="text-xs font-medium text-foreground mb-2 block">Line Field</Label>
                    </div>
                    
                    {/* Core Controls */}
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Line Count: {params.projection.lineFieldCount ?? 40}
                      </Label>
                      <Slider
                        value={[params.projection.lineFieldCount ?? 40]}
                        min={10}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateProjection('lineFieldCount', v)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Line Angle: {params.projection.lineFieldAngle ?? 0}°
                      </Label>
                      <Slider
                        value={[params.projection.lineFieldAngle ?? 0]}
                        min={0}
                        max={180}
                        step={5}
                        onValueChange={([v]) => updateProjection('lineFieldAngle', v)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Distortion: {((params.projection.lineFieldStrength ?? 1) * 100).toFixed(0)}%
                      </Label>
                      <Slider
                        value={[(params.projection.lineFieldStrength ?? 1) * 100]}
                        min={0}
                        max={300}
                        step={10}
                        onValueChange={([v]) => updateProjection('lineFieldStrength', v / 100)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Influence Range: {((params.projection.lineFieldFalloff ?? 1.5) * 100).toFixed(0)}%
                      </Label>
                      <Slider
                        value={[(params.projection.lineFieldFalloff ?? 1.5) * 100]}
                        min={50}
                        max={400}
                        step={10}
                        onValueChange={([v]) => updateProjection('lineFieldFalloff', v / 100)}
                      />
                    </div>

                    {/* Mode Selection */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Distortion Mode</Label>
                      <Select
                        value={params.projection.lineFieldMode ?? 'around'}
                        onValueChange={(v) => updateProjection('lineFieldMode', v as LineFieldMode)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LINE_FIELD_MODE_LABELS).map(([key, { label, description }]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              <div className="flex flex-col">
                                <span>{label}</span>
                                <span className="text-muted-foreground text-[10px]">{description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Geometry Mode */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Geometry</Label>
                      <Select
                        value={params.projection.lineFieldGeometry ?? 'parallel'}
                        onValueChange={(v) => updateProjection('lineFieldGeometry', v as LineFieldGeometry)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LINE_FIELD_GEOMETRY_LABELS).map(([key, { label, description }]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              <div className="flex flex-col">
                                <span>{label}</span>
                                <span className="text-muted-foreground text-[10px]">{description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Layer Effects */}
                    <div className="border-t border-border pt-3 mt-2">
                      <Label className="text-xs font-medium text-foreground mb-2 block">Layer Effects</Label>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Overlay Layers: {params.projection.lineFieldOverlayCount ?? 1}
                      </Label>
                      <Slider
                        value={[params.projection.lineFieldOverlayCount ?? 1]}
                        min={1}
                        max={4}
                        step={1}
                        onValueChange={([v]) => updateProjection('lineFieldOverlayCount', v)}
                      />
                    </div>

                    {(params.projection.lineFieldOverlayCount ?? 1) > 1 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Layer Offset: {params.projection.lineFieldOverlayOffset ?? 45}°
                        </Label>
                        <Slider
                          value={[params.projection.lineFieldOverlayOffset ?? 45]}
                          min={15}
                          max={90}
                          step={5}
                          onValueChange={([v]) => updateProjection('lineFieldOverlayOffset', v)}
                        />
                      </div>
                    )}

                    {/* Organic Effects */}
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Hand-drawn Wobble: {((params.projection.lineFieldWobble ?? 0) * 100).toFixed(0)}%
                      </Label>
                      <Slider
                        value={[(params.projection.lineFieldWobble ?? 0) * 100]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([v]) => updateProjection('lineFieldWobble', v / 100)}
                      />
                    </div>

                    {/* Wave modulation */}
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Wave Amplitude: {params.projection.lineFieldWaveAmp ?? 0}
                      </Label>
                      <Slider
                        value={[params.projection.lineFieldWaveAmp ?? 0]}
                        min={0}
                        max={20}
                        step={1}
                        onValueChange={([v]) => updateProjection('lineFieldWaveAmp', v)}
                      />
                    </div>

                    {(params.projection.lineFieldWaveAmp ?? 0) > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Wave Frequency: {params.projection.lineFieldWaveFreq ?? 3}
                        </Label>
                        <Slider
                          value={[params.projection.lineFieldWaveFreq ?? 3]}
                          min={1}
                          max={10}
                          step={0.5}
                          onValueChange={([v]) => updateProjection('lineFieldWaveFreq', v)}
                        />
                      </div>
                    )}

                    {/* Negative Space Option */}
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-xs text-muted-foreground">Break Lines Inside Shape</Label>
                      <Switch
                        checked={params.projection.lineFieldBreakInside ?? false}
                        onCheckedChange={(v) => updateProjection('lineFieldBreakInside', v)}
                      />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* Preview Colors */}
      <Accordion type="single" collapsible>
        <AccordionItem value="previewColors" className="border-none">
          <AccordionTrigger className="py-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5" />
              Preview Colors
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {/* Paper Presets */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Paper</Label>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(PAPER_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={params.previewColors.paperTint === key ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-8 gap-1"
                    onClick={() => {
                      onParamsChange({
                        ...params,
                        previewColors: {
                          ...params.previewColors,
                          paperTint: key as PlotterPreviewColors['paperTint'],
                          backgroundColor: preset.background,
                          strokeColor: params.previewColors.multiPen ? params.previewColors.strokeColor : preset.stroke,
                        },
                      });
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: preset.background }}
                    />
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Stroke Color */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Stroke</Label>
              <input
                type="color"
                value={params.previewColors.strokeColor}
                onChange={(e) => onParamsChange({
                  ...params,
                  previewColors: { ...params.previewColors, strokeColor: e.target.value },
                })}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
              />
              <Input
                value={params.previewColors.strokeColor}
                onChange={(e) => onParamsChange({
                  ...params,
                  previewColors: { ...params.previewColors, strokeColor: e.target.value },
                })}
                className="h-8 text-xs font-mono flex-1"
              />
            </div>

            {/* Stroke Width */}
            <div>
              <Label className="text-xs text-muted-foreground">
                Stroke Width: {params.previewColors.strokeWidth.toFixed(1)}
              </Label>
              <Slider
                value={[params.previewColors.strokeWidth * 10]}
                min={2}
                max={20}
                step={1}
                onValueChange={([v]) => onParamsChange({
                  ...params,
                  previewColors: { ...params.previewColors, strokeWidth: v / 10 },
                })}
              />
            </div>

            {/* Multi-pen toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Multi-pen by Layer</Label>
              <Switch
                checked={params.previewColors.multiPen}
                onCheckedChange={(v) => onParamsChange({
                  ...params,
                  previewColors: { ...params.previewColors, multiPen: v },
                })}
              />
            </div>

            {/* Multi-pen color swatches */}
            {params.previewColors.multiPen && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pen Colors</Label>
                <div className="grid grid-cols-4 gap-2">
                  {params.previewColors.penColors.map((color, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...params.previewColors.penColors];
                          newColors[i] = e.target.value;
                          onParamsChange({
                            ...params,
                            previewColors: { ...params.previewColors, penColors: newColors },
                          });
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <span className="text-[10px] text-muted-foreground">Pen {i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Export Settings */}
      <Accordion type="single" collapsible defaultValue="export">
        <AccordionItem value="export" className="border-none">
          <AccordionTrigger className="py-2 text-sm font-medium">
            Export
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Machine Preset</Label>
              <Select
                value={params.machinePreset}
                onValueChange={(v) => updateParams('machinePreset', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLOTTER_MACHINES).map(([key, machine]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={handleExportSVG}
                disabled={!drawing}
                variant="default"
                size="sm"
                className="gap-1.5"
              >
                <FileImage className="w-3.5 h-3.5" />
                SVG
              </Button>
              <Button
                onClick={handleExportGCode}
                disabled={!drawing}
                variant="secondary"
                size="sm"
                className="gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                G-code
              </Button>
              <Button
                onClick={handleExportHPGL}
                disabled={!drawing}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                HPGL
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default PlotterControls;
