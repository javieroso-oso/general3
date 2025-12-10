import { PrintSettings, defaultPrintSettings } from '@/types/parametric';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { motion } from 'framer-motion';

interface PrintSettingsPanelProps {
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
}

const PrintSettingsPanel = ({ settings, onSettingsChange }: PrintSettingsPanelProps) => {
  const handleChange = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Material */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Material</label>
        <Select
          value={settings.material}
          onValueChange={(v) => handleChange('material', v as PrintSettings['material'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PLA">PLA (Standard)</SelectItem>
            <SelectItem value="PETG">PETG (Durable)</SelectItem>
            <SelectItem value="ABS">ABS (Heat Resistant)</SelectItem>
            <SelectItem value="TPU">TPU (Flexible)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Layer Height */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Layer Height</label>
          <span className="text-sm font-semibold">{settings.layerHeight}mm</span>
        </div>
        <Select
          value={settings.layerHeight.toString()}
          onValueChange={(v) => handleChange('layerHeight', parseFloat(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.1">0.10mm (Fine)</SelectItem>
            <SelectItem value="0.16">0.16mm (Normal)</SelectItem>
            <SelectItem value="0.2">0.20mm (Standard)</SelectItem>
            <SelectItem value="0.28">0.28mm (Draft)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Nozzle Diameter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Nozzle Diameter</label>
        <Select
          value={settings.nozzleDiameter.toString()}
          onValueChange={(v) => handleChange('nozzleDiameter', parseFloat(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.4">0.4mm (Standard)</SelectItem>
            <SelectItem value="0.6">0.6mm (Fast)</SelectItem>
            <SelectItem value="0.8">0.8mm (Ultra Fast)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Infill */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Infill</label>
          <span className="text-sm font-semibold">{settings.infillPercent}%</span>
        </div>
        <Slider
          value={[settings.infillPercent]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => handleChange('infillPercent', v)}
        />
      </div>

      {/* Print Speed */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Print Speed</label>
          <span className="text-sm font-semibold">{settings.printSpeed}mm/s</span>
        </div>
        <Slider
          value={[settings.printSpeed]}
          min={20}
          max={100}
          step={5}
          onValueChange={([v]) => handleChange('printSpeed', v)}
        />
      </div>

      {/* Brim Width */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Brim Width</label>
          <span className="text-sm font-semibold">{settings.brimWidth}mm</span>
        </div>
        <Slider
          value={[settings.brimWidth]}
          min={0}
          max={15}
          step={1}
          onValueChange={([v]) => handleChange('brimWidth', v)}
        />
      </div>

      {/* Supports */}
      <div className="flex items-center justify-between py-2">
        <label className="text-sm font-medium text-text-secondary">Enable Supports</label>
        <Switch
          checked={settings.supportEnabled}
          onCheckedChange={(v) => handleChange('supportEnabled', v)}
        />
      </div>
    </motion.div>
  );
};

export default PrintSettingsPanel;
