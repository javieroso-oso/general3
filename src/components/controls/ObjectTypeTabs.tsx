import { motion } from 'framer-motion';
import { ObjectType } from '@/types/parametric';
import { cn } from '@/lib/utils';

interface ObjectTypeTabsProps {
  activeType: ObjectType;
  onTypeChange: (type: ObjectType) => void;
}

const tabs: { type: ObjectType; label: string }[] = [
  { type: 'shape', label: 'Shape' },
  { type: 'plotter', label: 'Plotter' },
];

const ObjectTypeTabs = ({ activeType, onTypeChange }: ObjectTypeTabsProps) => {
  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.type}
          onClick={() => onTypeChange(tab.type)}
          className={cn(
            'relative px-8 py-2.5 rounded-lg font-medium text-sm transition-colors duration-200',
            activeType === tab.type
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {activeType === tab.type && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-primary rounded-lg shadow-lg"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ObjectTypeTabs;
