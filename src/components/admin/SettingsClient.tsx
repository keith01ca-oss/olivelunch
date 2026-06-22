'use client';

import { useState } from 'react';
import { Settings, Plus, Trash2, Save, Loader2, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsClient({ org }: { org: any }) {
  const [categories, setCategories] = useState<string[]>(org?.settings?.categories || ['main', 'side', 'snack', 'drink']);
  const [units, setUnits] = useState<string[]>(org?.settings?.units || ['g', 'kg', 'ml', 'L', 'cups', 'tbsp', 'tsp', 'pcs', 'oz', 'lbs', 'slices', 'cans', 'bags', 'chunk', 'pinch']);
  const [contactPhone, setContactPhone] = useState<string>(org?.settings?.contact_phone || '');
  const [contactEmail, setContactEmail] = useState<string>(org?.settings?.contact_email || '');
  const [contactWhatsapp, setContactWhatsapp] = useState<string>(org?.settings?.contact_whatsapp || '');
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> System Settings
          </h1>
          <p className="text-muted-foreground">Manage your global categories, units, and system defaults.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Category Management */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="font-bold text-primary uppercase tracking-wider text-sm">Menu Categories</h2>
            <button 
              onClick={() => setCategories([...categories, ''])}
              className="p-1 hover:bg-primary/10 text-primary rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">These appear in the "Category" dropdown when creating dishes.</p>
          
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <input 
                  value={cat}
                  onChange={(e) => {
                    const next = [...categories];
                    next[i] = e.target.value;
                    setCategories(next);
                  }}
                  placeholder="Category name..."
                  className="flex-1 h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background"
                />
                <button 
                  onClick={() => setCategories(categories.filter((_, idx) => idx !== i))}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Unit Management */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="font-bold text-primary uppercase tracking-wider text-sm">Ingredient Units</h2>
            <button 
              onClick={() => setUnits([...units, ''])}
              className="p-1 hover:bg-primary/10 text-primary rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">These appear in the "Unit" dropdown for recipes.</p>

          <div className="grid grid-cols-2 gap-2">
            {units.map((unit, i) => (
              <div key={i} className="flex items-center gap-1">
                <input 
                  value={unit}
                  onChange={(e) => {
                    const next = [...units];
                    next[i] = e.target.value;
                    setUnits(next);
                  }}
                  placeholder="Unit..."
                  className="flex-1 h-9 rounded-lg border px-2 text-xs focus:ring-1 focus:ring-primary outline-none bg-background font-mono"
                />
                <button 
                  onClick={() => setUnits(units.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b pb-2">
          <h2 className="font-bold text-primary uppercase tracking-wider text-sm">Contact Information</h2>
          <p className="text-xs text-muted-foreground mt-1">This phone number and email will be shown to users in their Settings → Contact Us page.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Support Phone</label>
            <input
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="e.g. +1 (800) 123-4567"
              className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Support Email</label>
            <input
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="e.g. support@olivelunch.com"
              type="email"
              className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background"
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
              placeholder="e.g. +16041234567 (include country code, no spaces)"
              className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background"
            />
            <p className="text-[10px] text-muted-foreground">Enter in international format: +16041234567. This is the number users will WhatsApp.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
