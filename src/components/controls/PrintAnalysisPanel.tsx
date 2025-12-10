import { PrintAnalysis, PrintSettings, PrintWarning } from '@/types/parametric';
import { AlertTriangle, CheckCircle, Clock, Scale, Layers, Info, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PrintAnalysisPanelProps {
  analysis: PrintAnalysis;
  settings: PrintSettings;
}

const WarningItem = ({ warning }: { warning: PrintWarning }) => {
  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };
  const Icon = icons[warning.type];
  
  return (
    <div className={cn(
      "p-3 rounded-lg text-sm",
      warning.type === 'error' && "bg-destructive/10 border border-destructive/30",
      warning.type === 'warning' && "bg-amber-500/10 border border-amber-500/30",
      warning.type === 'info' && "bg-primary/10 border border-primary/30",
    )}>
      <div className="flex items-start gap-2">
        <Icon className={cn(
          "w-4 h-4 mt-0.5 flex-shrink-0",
          warning.type === 'error' && "text-destructive",
          warning.type === 'warning' && "text-amber-500",
          warning.type === 'info' && "text-primary",
        )} />
        <div>
          <p className={cn(
            "font-medium",
            warning.type === 'error' && "text-destructive",
            warning.type === 'warning' && "text-amber-600",
            warning.type === 'info' && "text-primary",
          )}>
            {warning.message}
          </p>
          {warning.suggestion && (
            <p className="text-text-muted mt-1 text-xs">{warning.suggestion}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, unit }: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  unit?: string;
}) => (
  <div className="bg-secondary/50 rounded-lg p-3">
    <div className="flex items-center gap-2 text-text-muted mb-1">
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-semibold text-foreground">{value}</span>
      {unit && <span className="text-sm text-text-secondary">{unit}</span>}
    </div>
  </div>
);

const PrintAnalysisPanel = ({ analysis, settings }: PrintAnalysisPanelProps) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Status */}
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-xl",
        analysis.isValid ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-destructive/10 border border-destructive/30"
      )}>
        {analysis.isValid ? (
          <CheckCircle className="w-6 h-6 text-emerald-500" />
        ) : (
          <AlertCircle className="w-6 h-6 text-destructive" />
        )}
        <div>
          <p className={cn(
            "font-semibold",
            analysis.isValid ? "text-emerald-600" : "text-destructive"
          )}>
            {analysis.isValid ? "Ready to Print" : "Issues Detected"}
          </p>
          <p className="text-sm text-text-muted">
            {analysis.warnings.length === 0 
              ? "All parameters within printable limits"
              : `${analysis.warnings.filter(w => w.type === 'error').length} errors, ${analysis.warnings.filter(w => w.type === 'warning').length} warnings`
            }
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard 
          icon={Clock} 
          label="Est. Time" 
          value={formatTime(analysis.estimatedTime)} 
        />
        <StatCard 
          icon={Scale} 
          label="Material" 
          value={analysis.materialWeight.toFixed(0)} 
          unit="g"
        />
        <StatCard 
          icon={Layers} 
          label="Layers" 
          value={analysis.layerCount} 
        />
        <StatCard 
          icon={Info} 
          label="Filament" 
          value={analysis.materialLength.toFixed(1)} 
          unit="m"
        />
      </div>

      {/* Technical Details */}
      <div className="bg-secondary/30 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Min Wall Thickness</span>
          <span className={cn(
            "font-medium",
            analysis.minWallThickness < 1.2 ? "text-destructive" : "text-foreground"
          )}>
            {analysis.minWallThickness.toFixed(2)}mm
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Max Overhang</span>
          <span className={cn(
            "font-medium",
            analysis.maxOverhang > 45 ? "text-amber-500" : "text-foreground"
          )}>
            {analysis.maxOverhang.toFixed(1)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Base Contact</span>
          <span className="font-medium text-foreground">
            {analysis.baseContactArea.toFixed(0)}mm²
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Supports Needed</span>
          <span className={cn(
            "font-medium",
            analysis.needsSupport ? "text-amber-500" : "text-emerald-500"
          )}>
            {analysis.needsSupport ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Issues
          </h4>
          {analysis.warnings.map((warning, i) => (
            <WarningItem key={i} warning={warning} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default PrintAnalysisPanel;
