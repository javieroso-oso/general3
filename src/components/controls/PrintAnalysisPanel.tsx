import { PrintAnalysis, PrintSettings, PrintWarning, NonPlanarAnalysis } from '@/types/parametric';
import { AlertTriangle, CheckCircle, Clock, Scale, Layers, Info, AlertCircle, Compass, Zap, Target } from 'lucide-react';
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

const StatCard = ({ icon: Icon, label, value, unit, variant }: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  unit?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) => (
  <div className={cn(
    "bg-secondary/50 rounded-lg p-3",
    variant === 'success' && "bg-emerald-500/10 border border-emerald-500/20",
    variant === 'warning' && "bg-amber-500/10 border border-amber-500/20",
    variant === 'error' && "bg-destructive/10 border border-destructive/20",
  )}>
    <div className="flex items-center gap-2 text-text-muted mb-1">
      <Icon className={cn(
        "w-4 h-4",
        variant === 'success' && "text-emerald-500",
        variant === 'warning' && "text-amber-500",
        variant === 'error' && "text-destructive",
      )} />
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={cn(
        "text-xl font-semibold",
        variant === 'success' && "text-emerald-600",
        variant === 'warning' && "text-amber-600",
        variant === 'error' && "text-destructive",
        !variant && "text-foreground",
      )}>{value}</span>
      {unit && <span className="text-sm text-text-secondary">{unit}</span>}
    </div>
  </div>
);

// Non-planar specific stats panel
const NonPlanarStats = ({ analysis, settings }: { analysis: NonPlanarAnalysis; settings: PrintSettings }) => {
  const maxConfiguredAngle = settings.nonPlanar?.maxZAngle || 30;
  const percentNonPlanar = ((analysis.nonPlanarLayerCount / analysis.totalLayerCount) * 100).toFixed(0);
  
  const angleStatus = analysis.exceedsMaxAngle ? 'error' 
    : analysis.maxTiltAngle > maxConfiguredAngle - 5 ? 'warning' 
    : 'success';
  
  const safetyStatus = analysis.isSafeForPrinting ? 'success' : 'warning';
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Non-Planar Analysis
        </h4>
      </div>
      
      {/* Non-planar stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard 
          icon={Target}
          label="Max Tilt"
          value={analysis.maxTiltAngle.toFixed(1)}
          unit={`° / ${maxConfiguredAngle}°`}
          variant={angleStatus}
        />
        <StatCard 
          icon={Layers}
          label="Non-Planar"
          value={percentNonPlanar}
          unit="%"
        />
      </div>
      
      {/* Safety status */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg text-sm",
        safetyStatus === 'success' && "bg-emerald-500/10 border border-emerald-500/30",
        safetyStatus === 'warning' && "bg-amber-500/10 border border-amber-500/30",
      )}>
        {analysis.isSafeForPrinting ? (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-600 font-medium">Safe for non-planar printing</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-amber-600 font-medium">Review collision risks</span>
          </>
        )}
      </div>
      
      {/* Collision zones */}
      {analysis.collisionRiskZones.length > 0 && (
        <div className="bg-amber-500/5 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Zap className="w-4 h-4" />
            <span className="font-medium">
              {analysis.collisionRiskZones.length} potential collision zone{analysis.collisionRiskZones.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-text-muted text-xs">
            Areas where nozzle tilt approaches maximum angle. Consider reducing surface curvature or max Z angle setting.
          </p>
        </div>
      )}
      
      {/* Technical details */}
      <div className="bg-secondary/30 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Avg Tilt Angle</span>
          <span className="font-medium text-foreground">
            {analysis.avgTiltAngle.toFixed(1)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Non-Planar Layers</span>
          <span className="font-medium text-foreground">
            {analysis.nonPlanarLayerCount} / {analysis.totalLayerCount}
          </span>
        </div>
      </div>
    </div>
  );
};

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
        analysis.guaranteedSupportFree 
          ? "bg-emerald-500/15 border border-emerald-500/40"
          : analysis.isValid 
            ? "bg-emerald-500/10 border border-emerald-500/30" 
            : "bg-destructive/10 border border-destructive/30"
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
            {analysis.guaranteedSupportFree 
              ? "Support-Free Guaranteed" 
              : analysis.isValid 
                ? "Ready to Print" 
                : "Issues Detected"}
          </p>
          <p className="text-sm text-text-muted">
            {analysis.guaranteedSupportFree
              ? "No supports needed - all overhangs ≤45°"
              : analysis.warnings.length === 0 
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

      {/* Non-Planar Analysis (when in non-planar mode) */}
      {settings.printMode === 'non_planar' && analysis.nonPlanarAnalysis && (
        <NonPlanarStats analysis={analysis.nonPlanarAnalysis} settings={settings} />
      )}

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
