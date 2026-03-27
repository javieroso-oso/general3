import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Printer, CheckCircle, XCircle, LogIn, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface QueueItem {
  id: string;
  visitor_name: string;
  visitor_email: string | null;
  params: any;
  object_type: string;
  stl_url: string | null;
  thumbnail_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  printing: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  done: 'bg-green-500/20 text-green-700 border-green-500/30',
  failed: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const ExhibitAdmin = () => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Fetch queue
  useEffect(() => {
    if (!session) return;

    const fetchQueue = async () => {
      const { data, error } = await supabase
        .from('print_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Queue fetch error:', error);
      } else {
        setQueue((data || []) as QueueItem[]);
      }
      setLoading(false);
    };

    fetchQueue();

    // Realtime subscription
    const channel = supabase
      .channel('print-queue-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleLogin = async () => {
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoggingIn(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'printing') updates.started_at = new Date().toISOString();
    if (status === 'done' || status === 'failed') updates.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from('print_queue')
      .update(updates)
      .eq('id', id);

    if (error) toast.error(error.message);
    else toast.success(`Status updated to ${status}`);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Operator Login
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button onClick={handleLogin} disabled={loggingIn} className="w-full">
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const printingCount = queue.filter(q => q.status === 'printing').length;
  const doneToday = queue.filter(q => {
    if (q.status !== 'done') return false;
    const d = new Date(q.completed_at || q.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Print Queue</h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" /> {pendingCount} pending
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Printer className="w-3 h-3" /> {printingCount} printing
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="w-3 h-3" /> {doneToday} done today
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}>
              <LogIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No prints in queue yet. Waiting for visitors...
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Thumbnail */}
                  {item.thumbnail_url && (
                    <img
                      src={item.thumbnail_url}
                      alt="Design"
                      className="w-16 h-16 rounded-lg object-cover bg-secondary"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{item.visitor_name}</span>
                      <Badge className={statusColors[item.status] || ''}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.object_type} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      {item.visitor_email && ` · ${item.visitor_email}`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.stl_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-1"
                      >
                        <a href={item.stl_url} download>
                          <Download className="w-3.5 h-3.5" />
                          STL
                        </a>
                      </Button>
                    )}

                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus(item.id, 'printing')}
                        className="gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </Button>
                    )}

                    {item.status === 'printing' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatus(item.id, 'done')}
                          className="gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus(item.id, 'failed')}
                          className="gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExhibitAdmin;
