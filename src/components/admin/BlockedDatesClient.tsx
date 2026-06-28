'use client';

import { useState } from 'react';
import { CalendarX, CalendarRange, Trash2, Plus, AlertTriangle, BellRing } from 'lucide-react';
import { createBlockedDate, deleteBlockedDate, createProDRange, deleteProDRange, createDateWarning, deleteDateWarning } from '@/app/admin/blocked-dates/actions';
import { format, parseISO } from 'date-fns';

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

interface ProDRange {
  id: string;
  start_date: string;
  end_date: string;
  message: string;
}

interface DateWarning {
  id: string;
  date: string;
  message: string;
}

interface Props {
  initialBlockedDates: BlockedDate[];
  initialProDRanges: ProDRange[];
  initialDateWarnings: DateWarning[];
}

export default function BlockedDatesClient({ initialBlockedDates, initialProDRanges, initialDateWarnings }: Props) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>(initialBlockedDates);
  const [prodRanges, setProdRanges] = useState<ProDRange[]>(initialProDRanges);
  const [dateWarnings, setDateWarnings] = useState<DateWarning[]>(initialDateWarnings);

  // Single blocked date form
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [dateLoading, setDateLoading] = useState(false);

  // Range form
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeMessage, setRangeMessage] = useState('');
  const [rangeLoading, setRangeLoading] = useState(false);

  // Warning form
  const [warnDate, setWarnDate] = useState('');
  const [warnMessage, setWarnMessage] = useState('');
  const [warnLoading, setWarnLoading] = useState(false);

  // Custom confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleAddDate = async () => {
    if (!newDate || !newReason) return;
    setDateLoading(true);
    const res = await createBlockedDate(newDate, newReason);
    setDateLoading(false);
    if (res.error) return alert(res.error);
    setBlockedDates(prev => [...prev, { id: Date.now().toString(), date: newDate, reason: newReason }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate('');
    setNewReason('');
  };

  const handleDeleteDate = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Blocked Date',
      message: 'Are you sure you want to remove this blocked date? Parents will be able to order meals on this date again.',
      onConfirm: async () => {
        const res = await deleteBlockedDate(id);
        if (res.error) return alert(res.error);
        setBlockedDates(prev => prev.filter(d => d.id !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddRange = async () => {
    if (!rangeStart || !rangeEnd || !rangeMessage) return;
    setRangeLoading(true);
    const res = await createProDRange(rangeStart, rangeEnd, rangeMessage);
    setRangeLoading(false);
    if (res.error) return alert(res.error);
    setProdRanges(prev => [...prev, { id: Date.now().toString(), start_date: rangeStart, end_date: rangeEnd, message: rangeMessage }].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setRangeStart('');
    setRangeEnd('');
    setRangeMessage('');
  };

  const handleDeleteRange = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Date Range',
      message: 'Are you sure you want to remove this date range? Ordering will be re-enabled on these dates.',
      onConfirm: async () => {
        const res = await deleteProDRange(id);
        if (res.error) return alert(res.error);
        setProdRanges(prev => prev.filter(r => r.id !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddWarning = async () => {
    if (!warnDate || !warnMessage) return;
    setWarnLoading(true);
    const res = await createDateWarning(warnDate, warnMessage);
    setWarnLoading(false);
    if (res.error) return alert(res.error);
    setDateWarnings(prev => [...prev, { id: Date.now().toString(), date: warnDate, message: warnMessage }].sort((a, b) => a.date.localeCompare(b.date)));
    setWarnDate('');
    setWarnMessage('');
  };

  const handleDeleteWarning = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Date Warning',
      message: 'Are you sure you want to remove this warning? The notice banner will be removed from this date.',
      onConfirm: async () => {
        const res = await deleteDateWarning(id);
        if (res.error) return alert(res.error);
        setDateWarnings(prev => prev.filter(w => w.id !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy'); }
    catch { return dateStr; }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Blocked Dates & Warnings</h1>
        <p className="text-muted-foreground mt-1">Manage ordering availability and notices for parents on specific dates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* SINGLE BLOCKED DATES */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg">
              <CalendarX className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Blocked Days</h2>
              <p className="text-xs text-muted-foreground">Parents <strong>cannot order</strong> on these dates</p>
            </div>
          </div>
          <div className="p-4 border-b bg-muted/10 space-y-3">
            <div className="flex flex-col gap-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary" />
              <div className="flex gap-2">
                <input type="text" placeholder="Reason (e.g. PA Day, School Holiday)" value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  onKeyDown={e => e.key === 'Enter' && handleAddDate()} />
                <button onClick={handleAddDate} disabled={dateLoading || !newDate || !newReason}
                  className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto p-4 space-y-2 flex-1 max-h-72">
            {blockedDates.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No dates blocked.</p>
            ) : blockedDates.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border bg-background hover:border-red-300 transition-colors">
                <div>
                  <p className="font-bold text-sm">{formatDate(d.date)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.reason}</p>
                </div>
                <button onClick={() => handleDeleteDate(d.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* DATE RANGES (Pro-D) */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-lg">
              <CalendarRange className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Date Ranges</h2>
              <p className="text-xs text-muted-foreground">Block a range (e.g. Spring Break, Pro-D week)</p>
            </div>
          </div>
          <div className="p-4 border-b bg-muted/10 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Start Date</label>
                <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">End Date</label>
                <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Label (e.g. Spring Break)" value={rangeMessage}
                onChange={e => setRangeMessage(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === 'Enter' && handleAddRange()} />
              <button onClick={handleAddRange} disabled={rangeLoading || !rangeStart || !rangeEnd || !rangeMessage}
                className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-4 space-y-2 flex-1 max-h-72">
            {prodRanges.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No date ranges blocked.</p>
            ) : prodRanges.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border bg-background hover:border-amber-300 transition-colors">
                <div>
                  <p className="font-bold text-sm">{r.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
                </div>
                <button onClick={() => handleDeleteRange(r.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* DATE WARNINGS */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
            <div className="bg-yellow-400/10 p-2 rounded-lg">
              <BellRing className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Date Warnings</h2>
              <p className="text-xs text-muted-foreground">Show an <strong>amber notice</strong> on a date — parents <strong>can still order</strong>, but will see your message</p>
            </div>
          </div>
          <div className="p-4 border-b bg-muted/10">
            <div className="flex gap-2">
              <input type="date" value={warnDate} onChange={e => setWarnDate(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary" />
              <input type="text" placeholder="Warning message (e.g. Early dismissal — order by 10am)" value={warnMessage}
                onChange={e => setWarnMessage(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === 'Enter' && handleAddWarning()} />
              <button onClick={handleAddWarning} disabled={warnLoading || !warnDate || !warnMessage}
                className="bg-yellow-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-yellow-600 flex items-center gap-1.5 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Add Warning
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72">
            {dateWarnings.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8 md:col-span-2">No warnings set.</p>
            ) : dateWarnings.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-yellow-200 bg-yellow-50 hover:border-yellow-400 transition-colors">
                <div>
                  <p className="font-bold text-sm text-yellow-800">{formatDate(w.date)}</p>
                  <p className="text-xs text-yellow-700 mt-0.5">{w.message}</p>
                </div>
                <button onClick={() => handleDeleteWarning(w.id)}
                  className="p-1.5 text-yellow-500 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-700">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Instant Effect</p>
          <p>Changes take effect immediately. No restart required.</p>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-card border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-500">
              <div className="bg-red-500/10 p-2.5 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-sm font-semibold border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
