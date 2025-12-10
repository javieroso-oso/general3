import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shuffle, Package, Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ParametricParams, generateBatchVariations, PrintSettings, analyzePrint } from '@/types/parametric';
import { toast } from 'sonner';

interface BatchGeneratorProps {
  baseParams: ParametricParams;
  printSettings: PrintSettings;
  onSelectVariation: (params: ParametricParams) => void;
}

const BatchGenerator = ({ baseParams, printSettings, onSelectVariation }: BatchGeneratorProps) => {
  const [batchSize, setBatchSize] = useState(6);
  const [variationStrength, setVariationStrength] = useState(0.15);
  const [variations, setVariations] = useState<ParametricParams[]>([]);

  const handleGenerate = () => {
    const newVariations = generateBatchVariations(baseParams, batchSize, variationStrength);
    // Filter to only printable variations
    const printableVariations = newVariations.filter(v => 
      analyzePrint(v, printSettings).isValid
    );
    setVariations(printableVariations);
    toast.success(`Generated ${printableVariations.length} printable variations`);
  };

  const handleExportBatch = () => {
    if (variations.length === 0) {
      toast.error('Generate variations first');
      return;
    }
    
    const batchData = {
      timestamp: new Date().toISOString(),
      printSettings,
      variations: variations.map((v, i) => ({
        id: `batch_${i + 1}`,
        params: v,
        analysis: analyzePrint(v, printSettings),
      })),
    };
    
    const blob = new Blob([JSON.stringify(batchData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Batch configuration exported');
  };

  const totalTime = variations.reduce((acc, v) => 
    acc + analyzePrint(v, printSettings).estimatedTime, 0
  );

  const totalMaterial = variations.reduce((acc, v) => 
    acc + analyzePrint(v, printSettings).materialWeight, 0
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="space-y-4">
        {/* Batch Size */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-text-secondary">Batch Size</label>
            <span className="text-sm font-semibold">{batchSize} units</span>
          </div>
          <Slider
            value={[batchSize]}
            min={2}
            max={24}
            step={1}
            onValueChange={([v]) => setBatchSize(v)}
          />
        </div>

        {/* Variation Strength */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-text-secondary">Variation</label>
            <span className="text-sm font-semibold">{(variationStrength * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[variationStrength]}
            min={0.05}
            max={0.4}
            step={0.05}
            onValueChange={([v]) => setVariationStrength(v)}
          />
        </div>

        <Button onClick={handleGenerate} className="w-full gap-2">
          <Shuffle className="w-4 h-4" />
          Generate Batch
        </Button>
      </div>

      {/* Generated Variations */}
      {variations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Variations ({variations.length})
            </h4>
            <Button variant="outline" size="sm" onClick={handleExportBatch} className="gap-2">
              <Download className="w-3 h-3" />
              Export
            </Button>
          </div>
          
          {/* Summary */}
          <div className="bg-secondary/50 rounded-lg p-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-muted">Total Time</span>
              <p className="font-semibold">{Math.round(totalTime / 60)}h {Math.round(totalTime % 60)}m</p>
            </div>
            <div>
              <span className="text-text-muted">Total Material</span>
              <p className="font-semibold">{(totalMaterial / 1000).toFixed(2)}kg</p>
            </div>
          </div>

          {/* Variation Cards */}
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {variations.map((v, i) => {
              const analysis = analyzePrint(v, printSettings);
              return (
                <button
                  key={i}
                  onClick={() => onSelectVariation(v)}
                  className="p-2 bg-secondary/50 rounded-lg text-left hover:bg-secondary transition-colors"
                >
                  <div className="text-xs font-medium text-foreground">#{i + 1}</div>
                  <div className="text-xs text-text-muted">
                    {Math.round(analysis.estimatedTime)}m
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default BatchGenerator;
