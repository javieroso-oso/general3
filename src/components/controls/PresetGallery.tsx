import { motion } from 'framer-motion';
import { presets, Preset, ObjectType, ParametricParams } from '@/types/parametric';
import { cn } from '@/lib/utils';

interface PresetGalleryProps {
  type: ObjectType;
  currentParams: ParametricParams;
  onSelect: (params: ParametricParams) => void;
}

const PresetGallery = ({ type, currentParams, onSelect }: PresetGalleryProps) => {
  const filteredPresets = presets.filter((preset) => preset.type === type);

  const isActive = (preset: Preset) => {
    return JSON.stringify(preset.params) === JSON.stringify(currentParams);
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
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(preset.params)}
            className={cn(
              'preset-card text-left',
              isActive(preset) && 'active'
            )}
          >
            <div className="aspect-square rounded-lg bg-secondary/80 mb-2 flex items-center justify-center">
              <div className="w-8 h-12 rounded-full bg-muted-foreground/30" 
                style={{
                  transform: `scaleX(${preset.params.topRadius / preset.params.baseRadius})`,
                  borderRadius: preset.params.twistAngle > 0 ? '40%' : '50%'
                }}
              />
            </div>
            <span className="text-sm font-medium text-foreground">{preset.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default PresetGallery;
