import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  LampHardware, 
  SocketType, 
  BulbShape, 
  LampStyle, 
  CordExit,
  socketDimensions,
  bulbDimensions,
} from '@/types/lamp';
import { Lightbulb, Plug, Cable, Home } from 'lucide-react';

interface HardwareSelectorProps {
  hardware: LampHardware;
  onHardwareChange: (hardware: LampHardware) => void;
}

const socketOptions: { value: SocketType; label: string; description: string }[] = [
  { value: 'E26', label: 'E26 (Standard US)', description: '26mm - Most common' },
  { value: 'E27', label: 'E27 (Standard EU)', description: '27mm - European' },
  { value: 'E12', label: 'E12 (Candelabra)', description: '12mm - Small/accent' },
  { value: 'GU10', label: 'GU10 (Spotlight)', description: '50mm - Track lights' },
  { value: 'G9', label: 'G9 (Bi-pin)', description: '9mm - Compact' },
  { value: 'LED_Strip', label: 'LED Strip', description: 'Flexible LED' },
];

const bulbOptions: { value: BulbShape; label: string; description: string }[] = [
  { value: 'A19', label: 'A19 Standard', description: '60mm × 110mm' },
  { value: 'A21', label: 'A21 Large', description: '68mm × 135mm' },
  { value: 'Globe', label: 'Globe G25', description: '80mm sphere' },
  { value: 'Candle', label: 'Candle', description: '35mm × 100mm' },
  { value: 'Edison', label: 'Edison ST64', description: '64mm × 140mm' },
  { value: 'PAR30', label: 'PAR30 Flood', description: '95mm × 90mm' },
  { value: 'Tube', label: 'Tube T10', description: '30mm × 120mm' },
];

const styleOptions: { value: LampStyle; label: string; icon: string }[] = [
  { value: 'pendant', label: 'Pendant', icon: '🔮' },
  { value: 'standing', label: 'Standing', icon: '🏠' },
  { value: 'wall_sconce', label: 'Wall Sconce', icon: '🪟' },
];

const cordExitOptions: { value: CordExit; label: string; description: string }[] = [
  { value: 'top_hidden', label: 'Top (Hidden)', description: 'Cord exits through mounting' },
  { value: 'bottom_center', label: 'Bottom Center', description: 'Traditional table lamp' },
  { value: 'bottom_side', label: 'Bottom Side', description: 'Offset cord exit' },
  { value: 'internal_channel', label: 'Internal Channel', description: 'Hidden in wall' },
];

const HardwareSelector = ({ hardware, onHardwareChange }: HardwareSelectorProps) => {
  const updateHardware = <K extends keyof LampHardware>(key: K, value: LampHardware[K]) => {
    onHardwareChange({ ...hardware, [key]: value });
  };
  
  return (
    <div className="space-y-6">
      {/* Socket Type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-primary" />
          <Label className="text-xs font-bold uppercase tracking-wider">Socket Type</Label>
        </div>
        <Select
          value={hardware.socketType}
          onValueChange={(v) => updateHardware('socketType', v as SocketType)}
        >
          <SelectTrigger className="bg-card border-2 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-2 border-border">
            {socketOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ø{socketDimensions[hardware.socketType].outerDiameter}mm × {socketDimensions[hardware.socketType].height}mm
        </p>
      </div>
      
      {/* Bulb Shape */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-secondary" />
          <Label className="text-xs font-bold uppercase tracking-wider">Bulb Shape</Label>
        </div>
        <Select
          value={hardware.bulbShape}
          onValueChange={(v) => updateHardware('bulbShape', v as BulbShape)}
        >
          <SelectTrigger className="bg-card border-2 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-2 border-border">
            {bulbOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ø{bulbDimensions[hardware.bulbShape].diameter}mm × {bulbDimensions[hardware.bulbShape].height}mm
        </p>
      </div>
      
      {/* Wattage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider">Bulb Wattage</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{hardware.bulbWattage}W</span>
        </div>
        <Slider
          value={[hardware.bulbWattage]}
          onValueChange={([v]) => updateHardware('bulbWattage', v)}
          min={3}
          max={60}
          step={1}
          className="py-2"
        />
        <p className="text-xs text-muted-foreground">
          {hardware.bulbWattage <= 10 ? 'LED recommended' : hardware.bulbWattage <= 25 ? 'LED or CFL' : 'High heat - ensure ventilation'}
        </p>
      </div>
      
      {/* Lamp Style */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-accent" />
          <Label className="text-xs font-bold uppercase tracking-wider">Lamp Style</Label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {styleOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateHardware('lampStyle', opt.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${
                hardware.lampStyle === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <p className="text-xs mt-1">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Cord Exit */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-muted-foreground" />
          <Label className="text-xs font-bold uppercase tracking-wider">Cord Exit</Label>
        </div>
        <RadioGroup
          value={hardware.cordExit}
          onValueChange={(v) => updateHardware('cordExit', v as CordExit)}
          className="space-y-2"
        >
          {cordExitOptions.map((opt) => (
            <div key={opt.value} className="flex items-start space-x-3">
              <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
              <label htmlFor={opt.value} className="cursor-pointer">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      {/* Cord Diameter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider">Cord Diameter</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{hardware.cordDiameter}mm</span>
        </div>
        <Slider
          value={[hardware.cordDiameter]}
          onValueChange={([v]) => updateHardware('cordDiameter', v)}
          min={4}
          max={12}
          step={0.5}
          className="py-2"
        />
      </div>
    </div>
  );
};

export default HardwareSelector;
