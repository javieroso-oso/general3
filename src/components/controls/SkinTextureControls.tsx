import { useMemo, useRef, useEffect } from 'react';
import { Sparkles, Dices } from 'lucide-react';
import { ParametricParams } from '@/types/parametric';
import ParameterSlider from './ParameterSlider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSkinPerturbation, skinSettingsFromParams } from '@/lib/skin-texture-generator';

interface SkinTextureControlsProps {
  params: ParametricParams;
  onParamsChange: (params: ParametricParams) => void;
}

type Mode = ParametricParams['skinTextureMode'];

const MODES: { id: Mode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'fuzz', label: 'Fuzz' },
  { id: 'knurl', label: 'Knurl' },
  { id: 'scales', label: 'Scales' },
  { id: 'ribs', label: 'Ribs' },
  { id: 'brushed', label: 'Brushed' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'hammered', label: 'Hammered' },
  { id: 'threads', label: 'Threads' },
];

const DENSITY_LABELS: Record<Mode, string> = {
  off: 'Density',
  fuzz: 'Jitter Rate',
  knurl: 'Diamond Count',
  scales: 'Cell Size',
  ribs: 'Rib Count',
  brushed: 'Grain Scale',
  pixel: 'Pixel Size',
  hammered: 'Dimple Count',
  threads: 'Thread Sharpness',
};

const MiniPreview = ({ params }: { params: ParametricParams }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const settings = skinSettingsFromParams(params);
    if (settings.mode === 'off' || settings.amplitude <= 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('Texture off', 10, H / 2 + 4);
      return;
    }

    // Render a strip: theta across X, height across Y. Color = perturbation magnitude.
    const cellW = 2;
    const cellH = 2;
    for (let y = 0; y < H; y += cellH) {
      const t = y / H;
      for (let x = 0; x < W; x += cellW) {
        const theta = (x / W) * Math.PI * 2;
        const d = getSkinPerturbation(t, theta, settings, {
          heightMm: params.height,
          layerHeightMm: 0.2,
        });
        // Map [-amp, +amp] to grayscale around mid-gray
        const norm = Math.max(-1, Math.min(1, d / Math.max(0.01, settings.amplitude)));
        const v = Math.round(180 + norm * 70);
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(x, y, cellW, cellH);
      }
    }
  }, [params]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={64}
      className="w-full rounded-md border border-border"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

const SkinTextureControls = ({ params, onParamsChange }: SkinTextureControlsProps) => {
  const set = <K extends keyof ParametricParams>(key: K, value: ParametricParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  const wallWarning = useMemo(
    () => params.skinTextureMode !== 'off' && params.skinTextureAmplitude > params.wallThickness * 0.5,
    [params.skinTextureMode, params.skinTextureAmplitude, params.wallThickness]
  );

  const isOff = params.skinTextureMode === 'off';

  return (
    <div className="space-y-3">
      {/* Mode picker */}
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => set('skinTextureMode', m.id)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md border transition-colors',
              params.skinTextureMode === m.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-text-secondary border-border hover:border-primary/50'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {!isOff && (
        <>
          {/* Live preview swatch */}
          <MiniPreview params={params} />

          {/* Amplitude */}
          <ParameterSlider
            label="Amplitude"
            value={params.skinTextureAmplitude}
            min={0}
            max={0.8}
            step={0.02}
            unit="mm"
            onChange={(v) => set('skinTextureAmplitude', v)}
          />
          {wallWarning && (
            <p className="text-xs text-[hsl(var(--destructive))]">
              Amplitude exceeds half the wall thickness — risk of perforating the wall.
            </p>
          )}

          {/* Density */}
          <ParameterSlider
            label={DENSITY_LABELS[params.skinTextureMode]}
            value={params.skinTextureDensity}
            min={0.25}
            max={3}
            step={0.05}
            onChange={(v) => set('skinTextureDensity', v)}
          />

          {/* Direction (fuzz / pixel) */}
          {(params.skinTextureMode === 'fuzz' || params.skinTextureMode === 'pixel') && (
            <div className="space-y-1.5">
              <div className="text-xs text-text-secondary">Direction</div>
              <div className="flex gap-1">
                {(['outward', 'both', 'inward'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => set('skinTextureDirection', d)}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md border capitalize transition-colors',
                      params.skinTextureDirection === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-text-secondary border-border hover:border-primary/50'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Range */}
          <ParameterSlider
            label="Skip Bottom"
            value={params.skinTextureStartHeightPct}
            min={0}
            max={0.3}
            step={0.01}
            onChange={(v) => set('skinTextureStartHeightPct', v)}
          />
          <ParameterSlider
            label="Skip Top"
            value={params.skinTextureEndHeightPct}
            min={0}
            max={0.3}
            step={0.01}
            onChange={(v) => set('skinTextureEndHeightPct', v)}
          />

          {/* Seed */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-text-secondary flex-shrink-0">Seed</div>
            <input
              type="number"
              value={params.skinTextureSeed}
              onChange={(e) => set('skinTextureSeed', parseInt(e.target.value, 10) || 0)}
              className="flex-1 px-2 py-1 text-xs rounded-md border border-border bg-background"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => set('skinTextureSeed', Math.floor(Math.random() * 100000))}
              className="h-7 w-7 p-0"
              aria-label="Randomize seed"
            >
              <Dices className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-text-secondary">
            <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
            <span>XY-only — safe on Bambu A1 and any planar FDM printer.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default SkinTextureControls;
