import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
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
import { Download, Shuffle, FileCode, FileImage } from 'lucide-react';
import { 
  PlotterParams, 
  PAPER_SIZES, 
  GenerativePattern, 
  PLOTTER_MACHINES,
  defaultFlowFieldParams,
  defaultSpiralParams,
  defaultLissajousParams,
  defaultWaveParams,
} from '@/types/plotter';
import { PlotterDrawing } from '@/types/plotter';
import { downloadSVG, downloadPlotterGCode, downloadHPGL } from '@/lib/plotter/export';

interface PlotterControlsProps {
  params: PlotterParams;
  drawing: PlotterDrawing | null;
  onParamsChange: (params: PlotterParams) => void;
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

const PlotterControls = ({ params, drawing, onParamsChange }: PlotterControlsProps) => {
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

  const randomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 10000);
    onParamsChange({
      ...params,
      flowField: { ...params.flowField, seed: newSeed },
      spiral: { ...params.spiral, seed: newSeed },
      particles: { ...params.particles, seed: newSeed },
    });
  }, [params, onParamsChange]);

  const handleExportSVG = useCallback(() => {
    if (!drawing) return;
    const filename = `plotter_${params.pattern}_${Date.now()}.svg`;
    downloadSVG(drawing, filename);
  }, [drawing, params.pattern]);

  const handleExportGCode = useCallback(() => {
    if (!drawing) return;
    const filename = `plotter_${params.pattern}_${Date.now()}.gcode`;
    downloadPlotterGCode(drawing, params.machinePreset, filename);
  }, [drawing, params.pattern, params.machinePreset]);

  const handleExportHPGL = useCallback(() => {
    if (!drawing) return;
    const filename = `plotter_${params.pattern}_${Date.now()}.hpgl`;
    downloadHPGL(drawing, filename);
  }, [drawing, params.pattern]);

  return (
    <div className="space-y-4">
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

      {params.pattern === 'spiral' && (
        <Accordion type="single" collapsible defaultValue="spiral">
          <AccordionItem value="spiral" className="border-none">
            <AccordionTrigger className="py-2 text-sm font-medium">
              Spiral Settings
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Turns: {params.spiral.turns}
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
