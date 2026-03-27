import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface ExhibitQueueStatusProps {
  queuePosition: number;
  visitorName: string;
  onDone: () => void;
}

const ExhibitQueueStatus = ({ queuePosition, visitorName, onDone }: ExhibitQueueStatusProps) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div className="text-center py-6 space-y-4">
      <CheckCircle className="w-16 h-16 text-primary mx-auto" />
      <h2 className="text-2xl font-bold">You're in the queue!</h2>
      <p className="text-lg text-muted-foreground">
        Thanks, <span className="font-semibold text-foreground">{visitorName}</span>!
      </p>
      <div className="bg-secondary/50 rounded-xl p-6">
        <div className="text-5xl font-bold text-primary">#{queuePosition}</div>
        <p className="text-sm text-muted-foreground mt-2">in line</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Resetting in {countdown}s...
      </p>
    </div>
  );
};

export default ExhibitQueueStatus;
