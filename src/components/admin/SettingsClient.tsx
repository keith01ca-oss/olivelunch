'use client';

import { useState } from 'react';
import { 
  Settings, Plus, Trash2, Save, Loader2, Phone, Mail, Sun, Gift,
  Megaphone, MessageSquare, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { saveDashboardMessages, deleteSuggestion } from '@/app/admin/settings/actions';

export default function SettingsClient({ 
  org, 
  initialSuggestions,
  initialInfoMessage,
  initialWarningMessage
}: { 
  org: any;
  initialSuggestions: any[];
  initialInfoMessage: string;
  initialWarningMessage: string;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'announcements' | 'suggestions' | 'vip'>('general');
  const [categories, setCategories] = useState<string[]>(org?.settings?.categories || ['main', 'side', 'snack', 'drink']);
  const [units, setUnits] = useState<string[]>(org?.settings?.units || ['g', 'kg', 'ml', 'L', 'cups', 'tbsp', 'tsp', 'pcs', 'oz', 'lbs', 'slices', 'cans', 'bags', 'chunk', 'pinch']);
  const [contactPhone, setContactPhone] = useState<string>(org?.settings?.contact_phone || '');
  const [contactEmail, setContactEmail] = useState<string>(org?.settings?.contact_email || '');
  const [contactWhatsapp, setContactWhatsapp] = useState<string>(org?.settings?.contact_whatsapp || '');
  const [isSaving, setIsSaving] = useState(false);
  const [summerAction, setSummerAction] = useState<'apply' | null>(null);
  const [summerResult, setSummerResult] = useState<string | null>(null);

  // Announcement & Suggestion State variables
  const [suggestions, setSuggestions] = useState<any[]>(initialSuggestions);
  const [infoMessage, setInfoMessage] = useState(initialInfoMessage);
  const [warningMessage, setWarningMessage] = useState(initialWarningMessage);
  const [isSavingAnnouncements, setIsSavingAnnouncements] = useState(false);
  const [isDeletingSuggestion, setIsDeletingSuggestion] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings = { 
        ...(org.settings || {}), 
        categories: categories.filter(c => c.trim() !== '').map(c => c.toLowerCase().trim()),
        units: units.filter(u => u.trim() !== '').map(u => u.trim()),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        contact_whatsapp: contactWhatsapp.trim()
      };

      const res = await fetch(`/api/admin/orgs/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success('Settings updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAnnouncements = async () => {
    setIsSavingAnnouncements(true);
    try {
      const res = await saveDashboardMessages(org.id, { info: infoMessage, warning: warningMessage });
      if (res.success) {
        toast.success('Dashboard announcements updated successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save announcements');
    } finally {
      setIsSavingAnnouncements(false);
    }
  };

  const handleResolveSuggestion = async (id: string) => {
    if (!confirm('Mark this suggestion as resolved and remove it from the list?')) return;
    setIsDeletingSuggestion(id);
    try {
      const res = await deleteSuggestion(id);
      if (res.success) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
        toast.success('Suggestion resolved successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve suggestion');
    } finally {
      setIsDeletingSuggestion(null);
    }
  };

  const handleSummerCredit = async () => {
    if (!confirm('This will manually add $9.99 store credit to all active monthly VIP subscribers. Continue?')) return;
    setSummerAction('apply');
    setSummerResult(null);
    try {
      const res = await fetch('/api/admin/vip-summer-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const msg = `✅ ${data.affected} monthly VIP(s) credited $9.99. ${data.skipped} skipped (already credited or not monthly), ${data.failed} failed.`;
      setSummerResult(msg + (data.errors?.length > 0 ? ` Errors: ${data.errors.join('; ')}` : ''));
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply credits');
    } finally {
      setSummerAction(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Global Settings</h1>
            <p className="text-sm font-semibold text-muted-foreground mt-0.5">Configure system settings, announcements, and parent feedback.</p>
          </div>
        </div>
      </div>

      {/* Tabs Nav */}
      <div className="flex border-b border-border/80 gap-2 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          General & Support
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'announcements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Dashboard Announcements
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'suggestions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Suggestions ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('vip')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'vip'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sun className="w-4 h-4" />
          VIP Summer Credits
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categories Section */}
            <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="border-b pb-2">
                <h2 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Menu Categories</h2>
                <p className="text-xs text-muted-foreground mt-1">Define categories for menu planning (e.g. main, side, snack, drink).</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((c, i) => (
                  <div key={i} className="flex items-center gap-1 bg-muted/65 border pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-medium">
                    <span>{c}</span>
                    <button
                      onClick={() => setCategories(categories.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-lg text-muted-foreground hover:bg-muted-foreground/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add category..."
                  className="flex-1 h-10 rounded-xl border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim();
                      if (val && !categories.includes(val)) {
                        setCategories([...categories, val]);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Units Section */}
            <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="border-b pb-2">
                <h2 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Measurement Units</h2>
                <p className="text-xs text-muted-foreground mt-1">Specify units used for recipes, ingredients, and scaling.</p>
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                {units.map((u, i) => (
                  <div key={i} className="flex items-center gap-1 bg-muted/65 border pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-medium">
                    <span>{u}</span>
                    <button
                      onClick={() => setUnits(units.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-lg text-muted-foreground hover:bg-muted-foreground/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add unit..."
                  className="flex-1 h-10 rounded-xl border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim();
                      if (val && !units.includes(val)) {
                        setUnits([...units, val]);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Customer Support Contact */}
          <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b pb-2">
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Customer Support Contact Info</h2>
              <p className="text-xs text-muted-foreground mt-1">These support details will be visible to parents on their Settings page.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Support Phone</label>
                <input
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="e.g. +1 (604) 123-4567"
                  className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Support Email</label>
                <input
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="e.g. support@olivelunch.com"
                  type="email"
                  className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Number
                </label>
                <input
                  value={contactWhatsapp}
                  onChange={e => setContactWhatsapp(e.target.value)}
                  placeholder="e.g. +16041234567"
                  className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl hover:bg-primary/95 transition-all shadow-md disabled:opacity-50 text-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b pb-2 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 uppercase tracking-wider text-sm flex items-center gap-1.5"><Megaphone className="w-4 h-4 text-primary" /> Dashboard Banners</h2>
              <p className="text-xs text-muted-foreground mt-1">Configure announcement banners shown at the top of the parent dashboard.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Top Welcome Announcement (Info Blue Banner)</label>
              <textarea
                value={infoMessage}
                onChange={e => setInfoMessage(e.target.value)}
                placeholder="Enter welcome announcements here..."
                rows={3}
                className="w-full rounded-2xl border p-4 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Cutoff Alert Banner (Warning Yellow Banner)</label>
              <textarea
                value={warningMessage}
                onChange={e => setWarningMessage(e.target.value)}
                placeholder="Enter warning/alert text here..."
                rows={3}
                className="w-full rounded-2xl border p-4 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAnnouncements}
              disabled={isSavingAnnouncements}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl hover:bg-primary/95 transition-all shadow-md disabled:opacity-50 text-sm"
            >
              {isSavingAnnouncements ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Announcements
            </button>
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-bold text-slate-800 uppercase tracking-wider text-sm flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary" /> Parent Suggestions &amp; Feedback</h2>
            <p className="text-xs text-muted-foreground mt-1">Review feedback submitted by parents. Mark as resolved to clear them from this list.</p>
          </div>

          {suggestions.length === 0 ? (
            <div className="text-center py-16 bg-muted/25 rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 text-muted-foreground">
              <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="font-extrabold text-slate-900 text-lg">All Caught Up!</h3>
              <p className="text-sm font-medium mt-1">No suggestions or feedback from parents at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-muted/30 border border-border/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all hover:bg-muted/40 animate-in fade-in duration-200">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-extrabold text-slate-900">{s.parents?.name || 'Unknown Parent'}</span>
                      {s.parents?.email && (
                        <a href={`mailto:${s.parents.email}`} className="text-xs text-primary font-bold hover:underline">
                          {s.parents.email}
                        </a>
                      )}
                      <span className="text-xs text-muted-foreground font-medium">
                        · {new Date(s.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed bg-white/70 border border-white p-3.5 rounded-xl shadow-inner">
                      {s.content}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResolveSuggestion(s.id)}
                    disabled={isDeletingSuggestion === s.id}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 border rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-xs font-bold text-slate-600 transition-colors shadow-sm bg-card shrink-0 disabled:opacity-50"
                  >
                    {isDeletingSuggestion === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    Resolve Feedback
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'vip' && (
        <div className="bg-card border-2 border-amber-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-amber-100 pb-2">
            <h2 className="font-bold text-amber-700 uppercase tracking-wider text-sm flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" /> Summer VIP Credit (July &amp; August)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Adds $9.99 store credit to all active monthly VIP subscribers for summer break (offsetting their July &amp; August monthly payments). 
              Cron runs automatically on July 1 and August 1. Use this button to trigger manually.
            </p>
          </div>
          {summerResult && (
            <div className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl">
              {summerResult}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSummerCredit}
              disabled={summerAction !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {summerAction === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Apply Summer Credits (Manual)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
