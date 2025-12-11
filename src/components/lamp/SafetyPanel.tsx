import { useMemo } from 'react';
import { LampParams, LampHardware, LampSafetyAnalysis } from '@/types/lamp';
import { PrintSettings } from '@/types/parametric';
import { analyzeLampSafety } from '@/lib/lamp-analysis';
import { AlertTriangle, CheckCircle, XCircle, Thermometer, Wind, Lightbulb, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafetyPanelProps {
  params: LampParams;
  hardware: LampHardware;
  printSettings: PrintSettings;
}

const SafetyPanel = ({ params, hardware, printSettings }: SafetyPanelProps) => {
  const analysis = useMemo(() => {
    return analyzeLampSafety(params, hardware, printSettings);
  }, [params, hardware, printSettings]);
  
  const getHeatIcon = () => {
    switch (analysis.heatClearance) {
      case 'safe': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'danger': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };
  
  const getHeatColor = () => {
    switch (analysis.heatClearance) {
      case 'safe': return 'bg-green-500/10 border-green-500/30 text-green-700';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700';
      case 'danger': return 'bg-red-500/10 border-red-500/30 text-red-700';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={cn(
        'p-4 rounded-lg border-2',
        analysis.isValid 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      )}>
        <div className="flex items-center gap-3">
          {analysis.isValid 
            ? <CheckCircle className="w-6 h-6 text-green-500" />
            : <XCircle className="w-6 h-6 text-red-500" />
          }
          <div>
            <h3 className={cn(
              'font-bold',
              analysis.isValid ? 'text-green-700' : 'text-red-700'
            )}>
              {analysis.isValid ? 'Design is Safe' : 'Safety Issues Detected'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {analysis.isValid 
                ? 'Ready for printing and assembly'
                : 'Please address the warnings below'
              }
            </p>
          </div>
        </div>
      </div>
      
      {/* Heat Clearance */}
      <div className={cn('p-4 rounded-lg border-2', getHeatColor())}>
        <div className="flex items-center gap-3 mb-3">
          <Thermometer className="w-5 h-5" />
          <h4 className="font-bold text-sm uppercase tracking-wider">Heat Clearance</h4>
          {getHeatIcon()}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Bulb to Shade</p>
            <p className="font-mono text-lg">{analysis.bulbToShadeDistance.toFixed(1)}mm</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Wattage</p>
            <p className={cn(
              'font-mono text-lg',
              hardware.bulbWattage > analysis.maxSafeWattage && 'text-red-500'
            )}>
              {hardware.bulbWattage}W
            </p>
          </div>
        </div>
      </div>
      
      {/* Wattage Recommendations */}
      <div className="p-4 rounded-lg border-2 border-border bg-card">
        <div className="flex items-center gap-3 mb-3">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h4 className="font-bold text-sm uppercase tracking-wider">Wattage Limits</h4>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Max Safe</p>
            <p className="font-mono text-lg text-primary">{analysis.maxSafeWattage}W</p>
          </div>
          <div>
            <p className="text-muted-foreground">Recommended</p>
            <p className="font-mono text-lg text-secondary">{analysis.recommendedWattage}W</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Based on {printSettings.material} material limits
        </p>
      </div>
      
      {/* Ventilation Status */}
      <div className={cn(
        'p-4 rounded-lg border-2',
        analysis.ventilationAdequate 
          ? 'border-border bg-card' 
          : 'bg-yellow-500/10 border-yellow-500/30'
      )}>
        <div className="flex items-center gap-3">
          <Wind className={cn(
            'w-5 h-5',
            analysis.ventilationAdequate ? 'text-muted-foreground' : 'text-yellow-600'
          )} />
          <div>
            <h4 className="font-bold text-sm">Ventilation</h4>
            <p className={cn(
              'text-sm',
              analysis.ventilationAdequate ? 'text-muted-foreground' : 'text-yellow-700'
            )}>
              {analysis.ventilationAdequate 
                ? 'Adequate for current wattage' 
                : 'Add ventilation slots for better heat dissipation'
              }
            </p>
          </div>
        </div>
      </div>
      
      {/* Material Warnings */}
      {analysis.materialWarnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Material Warnings
          </h4>
          <ul className="space-y-2">
            {analysis.materialWarnings.map((warning, i) => (
              <li 
                key={i} 
                className="text-sm p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-800"
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Recommendations
          </h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, i) => (
              <li 
                key={i} 
                className="text-sm p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SafetyPanel;
