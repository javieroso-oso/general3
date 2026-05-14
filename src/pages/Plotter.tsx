import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Pen, Layers, Download } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import PlotterPreview from '@/components/plotter/PlotterPreview';
import { usePlotterDrawing } from '@/hooks/usePlotterDrawing';
import { defaultPlotterParams, PlotterParams } from '@/types/plotter';
import { defaultShapeParams, ParametricParams } from '@/types/parametric';
import { useMemo } from 'react';

interface Example {
  name: string;
  description: string;
  plotter: Partial<PlotterParams>;
  shape?: Partial<ParametricParams>;
}

const examples: Example[] = [
  {
    name: 'Contour Stack',
    description: 'Stacked horizontal slices of a 3D body — perfect for pen plotters.',
    plotter: { generator: 'contour-stack' as PlotterParams['generator'], lineCount: 30 },
  },
  {
    name: 'Flow Field',
    description: 'SDF-driven vector flow that warps lines around the active shape.',
    plotter: { generator: 'flow-field' as PlotterParams['generator'], lineCount: 80 },
  },
  {
    name: 'Spiral',
    description: 'Continuous archimedean spiral, single uninterrupted toolpath.',
    plotter: { generator: 'spiral' as PlotterParams['generator'] },
  },
  {
    name: 'Waves',
    description: 'Stacked sine bands; classic Lauren Thorson aesthetic.',
    plotter: { generator: 'waves' as PlotterParams['generator'], lineCount: 40 },
  },
];

const ExampleCard = ({ ex }: { ex: Example }) => {
  const params = useMemo(() => ({ ...defaultPlotterParams, ...ex.plotter }), [ex]);
  const meshParams = useMemo(() => ({ ...defaultShapeParams, ...(ex.shape ?? {}) }), [ex]);
  const drawing = usePlotterDrawing({
    params,
    currentMeshParams: meshParams,
    currentShapeStyle: 'vase',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="control-card flex flex-col gap-3"
    >
      <div className="aspect-square bg-secondary/30 rounded-lg overflow-hidden">
        <PlotterPreview drawing={drawing} margin={params.marginMm} previewColors={params.previewColors} />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{ex.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{ex.description}</p>
      </div>
      <Link to={`/?type=plotter&plotter=${encodeURIComponent(JSON.stringify(ex.plotter))}`}>
        <Button variant="outline" size="sm" className="w-full gap-2">
          Open in editor <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    </motion.div>
  );
};

const Plotter = () => {
  return (
    <Layout>
      <title>Plotter Mode — generative 2D vector art | general3</title>
      <meta name="description" content="Generative 2D vector art designed for pen plotters. Export SVG, GCode, and HPGL. Live-synced with your 3D parametric shape." />

      {/* Hero */}
      <section className="container mx-auto px-6 pt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Pen className="w-3 h-3" /> Plotter Mode
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-medium tracking-tight text-balance">
            Generative 2D art, ready for the pen plotter.
          </h1>
          <p className="text-muted-foreground mt-4 text-base md:text-lg max-w-2xl">
            Live-synced with your 3D shape. Export <span className="font-mono text-foreground">SVG</span>,
            <span className="font-mono text-foreground"> GCode</span>, or
            <span className="font-mono text-foreground"> HPGL</span>. Optimized travel paths.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/?type=plotter">
              <Button size="lg" className="gap-2">
                Open Plotter <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="outline">Back to 3D Generator</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-12 border-t border-border/50">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Layers, title: 'Live-synced', text: 'Plotter art reads parameters from your active 3D shape in real time.' },
            { icon: Pen, title: '6 projection modes', text: 'Contour stack, exploded view, flow fields, spirals, waves, and more.' },
            { icon: Download, title: 'Plotter-ready exports', text: 'SVG, GCode, HPGL with travel-path optimization (RDP + greedy nearest).' },
          ].map((f) => (
            <div key={f.title} className="control-card">
              <f.icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section className="container mx-auto px-6 py-12 border-t border-border/50">
        <h2 className="text-2xl font-display font-medium mb-6">Examples</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {examples.map((ex) => <ExampleCard key={ex.name} ex={ex} />)}
        </div>
      </section>
    </Layout>
  );
};

export default Plotter;
