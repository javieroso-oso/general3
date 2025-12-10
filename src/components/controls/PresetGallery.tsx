import { motion } from 'framer-motion';
import { presets, Preset, ObjectType, ParametricParams } from '@/types/parametric';
import { cn } from '@/lib/utils';

interface PresetGalleryProps {
  type: ObjectType;
  currentParams: ParametricParams;
  onSelect: (params: ParametricParams) => void;
}

// Generate a simple visual representation of the preset
const PresetVisual = ({ params }: { params: ParametricParams }) => {
  const { bulgeAmount, bulgePosition, topRadius, baseRadius, twistAngle, wobbleFrequency } = params;
  
  // Calculate visual properties
  const scaleX = topRadius / baseRadius;
  const rotation = twistAngle / 8;
  const borderRadius = wobbleFrequency > 0 ? '30%' : '40%';
  const bulgeScale = 1 + bulgeAmount * 0.5;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="w-10 h-16 bg-muted-foreground/40 transition-all duration-300"
        style={{
          transform: `scaleX(${scaleX}) rotate(${rotation}deg) scaleY(${bulgeScale})`,
          borderRadius: borderRadius,
          clipPath: `ellipse(${50 + bulgeAmount * 20}% ${50 + (1 - bulgePosition) * 20}% at 50% ${bulgePosition * 100}%)`,
        }}
      />
    </div>
  );
};

const PresetGallery = ({ type, currentParams, onSelect }: PresetGalleryProps) => {
  const filteredPresets = presets.filter((preset) => preset.type === type);

  const isActive = (preset: Preset) => {
    // Check if most key params match
    const keys: (keyof ParametricParams)[] = ['bulgeAmount', 'twistAngle', 'wobbleFrequency', 'asymmetry'];
    return keys.every(key => Math.abs(preset.params[key] - currentParams[key]) < 0.01);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Presets
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {filteredPresets.map((preset, index) => (
          <motion.button
            key={preset.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelect(preset.params)}
            className={cn(
              'preset-card text-left',
              isActive(preset) && 'active'
            )}
          >
            <div className="aspect-square rounded-lg bg-secondary/80 mb-2 overflow-hidden">
              <PresetVisual params={preset.params} />
            </div>
            <span className="text-sm font-medium text-foreground">{preset.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default PresetGallery;
