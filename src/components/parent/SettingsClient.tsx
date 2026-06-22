'use client';

import { useState } from 'react';
import { UserProfile } from '@clerk/nextjs';
import { User, Users, CreditCard, MessageSquare, Phone, ChevronRight, ArrowLeft, Plus, Edit2, Check, X, Send, Settings } from 'lucide-react';
import { submitSuggestion, updateChild, addChild } from '@/app/(parent)/settings/actions';
import { toast } from 'sonner';

type Tab = 'account' | 'children' | 'credits' | 'suggestions' | 'contact';

interface Props {
  parent: any;
  childrenList: any[];
  schools: any[];
  credits: any[];
  orgId: string;
  contactPhone?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
}

export default function SettingsClient({ parent, childrenList: initialChildren, schools, credits, orgId, contactPhone = '', contactEmail = '', contactWhatsapp = '' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null); // null means showing menu on mobile
  const [childrenList, setChildrenList] = useState(initialChildren);

  // Child Editing State
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', school_id: '', division: '', delivery_location: '', lunch_time: '' });
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Suggestion State
  const [suggestion, setSuggestion] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const tabs: { id: Tab; label: string; icon: any; desc: string }[] = [
    { id: 'account', label: 'Account Profile', icon: User, desc: 'Manage your email, password, and security.' },
    { id: 'children', label: 'My Children', icon: Users, desc: 'Manage children, schools, and divisions.' },
    { id: 'credits', label: 'Store Credit', icon: CreditCard, desc: 'View your balance and transaction history.' },
    { id: 'suggestions', label: 'Suggestions', icon: MessageSquare, desc: 'Send feedback directly to the kitchen.' },
    { id: 'contact', label: 'Contact Us', icon: Phone, desc: 'Get in touch via phone or email.' },
  ];

  // --- Handlers ---
  const handleSaveChild = async (childId: string) => {
    setIsSaving(true);
    const res = await updateChild(childId, editData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Child updated successfully');
      setChildrenList(childrenList.map(c => c.id === childId ? { 
        ...c, 
        name: editData.name, 
        school_id: editData.school_id, 
        division: editData.division,
        delivery_location: editData.delivery_location,
        lunch_time: editData.lunch_time,
        schools: { name: schools.find(s => s.id === editData.school_id)?.name || '' }
      } : c));
      setEditingChildId(null);
    }
    setIsSaving(false);
  };

  const handleAddChild = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const res = await addChild(formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Child added successfully!');
      // Reload page to get fresh data
      window.location.reload();
    }
    setIsSaving(false);
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestion.trim()) return toast.error('Please enter a suggestion.');
    setIsSubmittingSuggestion(true);
    const res = await submitSuggestion(parent.id, suggestion);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Suggestion sent! Thank you for your feedback.');
      setSuggestion('');
    }
    setIsSubmittingSuggestion(false);
  };

  // --- Renders ---
  const renderAccount = () => (
    <div className="flex justify-center md:justify-start">
      <UserProfile 
        routing="hash"
        appearance={{ elements: { rootBox: "w-full shadow-none border rounded-2xl overflow-hidden", card: "shadow-none w-full max-w-none" } }} 
      />
    </div>
  );

  const renderChildren = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Manage Children</h3>
        <button 
          onClick={() => setIsAddingChild(true)}
          className="flex items-center gap-1.5 text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Child
        </button>
      </div>

      {isAddingChild && (
        <form onSubmit={handleAddChild} className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h4 className="font-bold text-primary">Add New Child</h4>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="parentId" value={parent.id} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input name="name" required placeholder="Child's Full Name" className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" />
            <select name="schoolId" required className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none">
              <option value="">Select School...</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input name="division" required placeholder="Division (e.g. Div 5)" className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" />
            <input name="deliveryLocation" required placeholder="Delivery Location (e.g. Office)" className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" />
            <input name="lunchTime" required placeholder="Lunch Time (e.g. 12:00 PM)" className="rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAddingChild(false)} className="px-4 py-2 text-sm font-bold hover:bg-muted rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save Child</button>
          </div>
        </form>
      )}

      {childrenList.length === 0 && !isAddingChild ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">No children added yet.</div>
      ) : (
        <div className="space-y-3">
          {childrenList.map(child => {
            const isEditing = editingChildId === child.id;
            return (
              <div key={child.id} className="bg-card border rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:border-primary/30">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Name</label>
                        <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">School</label>
                        <select value={editData.school_id} onChange={e => setEditData({...editData, school_id: e.target.value})} className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-primary">
                          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Division</label>
                        <input value={editData.division} onChange={e => setEditData({...editData, division: e.target.value})} className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Delivery Location</label>
                        <input value={editData.delivery_location} onChange={e => setEditData({...editData, delivery_location: e.target.value})} className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Lunch Time</label>
                        <input value={editData.lunch_time} onChange={e => setEditData({...editData, lunch_time: e.target.value})} className="w-full mt-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-primary" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingChildId(null)} className="flex items-center gap-1 px-3 py-1.5 hover:bg-muted rounded-lg text-xs font-bold transition-colors"><X className="w-3.5 h-3.5" /> Cancel</button>
                      <button onClick={() => handleSaveChild(child.id)} disabled={isSaving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold transition-colors hover:bg-primary/90"><Check className="w-3.5 h-3.5" /> Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg">{child.name}</h4>
                      <p className="text-sm text-muted-foreground font-medium">{child.schools?.name} • <span className="text-foreground">Div {child.division}</span></p>
                    </div>
                    <button 
                      onClick={() => {
                        setEditData({ name: child.name, school_id: child.school_id, division: child.division, delivery_location: child.delivery_location || '', lunch_time: child.lunch_time || '' });
                        setEditingChildId(child.id);
                      }}
                      className="p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCredits = () => {
    const total = credits.reduce((sum, c) => sum + Number(c.amount), 0);
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-primary uppercase tracking-widest mb-1">Available Balance</p>
            <h2 className="text-5xl font-black text-foreground">${total.toFixed(2)}</h2>
          </div>
          <CreditCard className="w-16 h-16 text-primary opacity-20" />
        </div>
        
        <div>
          <h3 className="font-bold text-lg mb-4">Transaction History</h3>
          {credits.length === 0 ? (
            <div className="text-center py-10 border rounded-2xl bg-muted/20 text-muted-foreground text-sm">No credit history found.</div>
          ) : (
            <div className="border rounded-2xl overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {credits.map(c => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 capitalize font-medium">{c.source}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">+${Number(c.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSuggestions = () => (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-1">Send a Suggestion</h3>
        <p className="text-sm text-muted-foreground">We value your feedback! Let us know how we can improve the lunch program.</p>
      </div>
      <div className="space-y-4">
        <textarea
          rows={5}
          value={suggestion}
          onChange={e => setSuggestion(e.target.value)}
          placeholder="I would love to see more vegetarian options..."
          className="w-full p-4 rounded-2xl border bg-background resize-none focus:ring-2 focus:ring-primary outline-none shadow-sm"
        />
        <button 
          onClick={handleSuggestionSubmit}
          disabled={isSubmittingSuggestion}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
        >
          {isSubmittingSuggestion ? 'Sending...' : <><Send className="w-4 h-4" /> Send Feedback</>}
        </button>
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="max-w-lg space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-1">Contact Us</h3>
        <p className="text-sm text-muted-foreground">Need immediate assistance? Reach out to our team.</p>
      </div>
      {!contactPhone && !contactEmail && !contactWhatsapp ? (
        <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground text-sm">
          Contact information has not been set up yet. Please check back later.
        </div>
      ) : (
        <div className="grid gap-4">
          {contactWhatsapp && (() => {
            const clean = contactWhatsapp.replace(/[^0-9]/g, '');
            return (
              <a 
                href={`https://wa.me/${clean}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-between p-5 rounded-2xl border-2 border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <p className="font-bold text-lg text-green-950">WhatsApp Us</p>
                    <p className="text-sm text-green-700 font-medium font-mono">{contactWhatsapp}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-green-600" />
              </a>
            );
          })()}
          {contactPhone && (
            <a href={`tel:${contactPhone}`} className="flex items-center justify-between p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <p className="font-bold text-lg">Call Us</p>
                  <p className="text-sm text-muted-foreground font-medium">{contactPhone}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-primary" />
            </a>
          )}
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className="flex items-center justify-between p-5 rounded-2xl border-2 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <p className="font-bold text-lg text-blue-900">Email Us</p>
                  <p className="text-sm text-blue-700 font-medium">{contactEmail}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600" />
            </a>
          )}
        </div>
      )}
    </div>
  );

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      
      {/* Mobile view: Menu only shown if activeTab is null */}
      <div className={`md:w-72 shrink-0 space-y-2 ${activeTab !== null ? 'hidden md:block' : 'block'}`}>
        <h1 className="text-3xl font-extrabold mb-6 hidden md:block">Settings</h1>
        
        {/* Mobile Header */}
        <h1 className="text-3xl font-extrabold mb-6 md:hidden">Settings</h1>
        
        <div className="flex flex-col gap-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center p-4 rounded-2xl transition-all border-2 text-left ${
                  isActive 
                    ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                    : 'border-transparent hover:bg-muted text-foreground'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-4 ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold">{tab.label}</p>
                  {/* Show desc only on mobile list or if requested, keep simple */}
                  <p className="text-xs text-muted-foreground leading-snug md:hidden block mt-0.5">{tab.desc}</p>
                </div>
                <ChevronRight className={`w-5 h-5 md:hidden ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 ${activeTab === null ? 'hidden md:block' : 'block'}`}>
        
        {/* Mobile Back Button */}
        <div className="md:hidden mb-6">
          <button 
            onClick={() => setActiveTab(null)}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors bg-muted/50 px-4 py-2 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Settings Menu
          </button>
        </div>

        {activeTab ? (
          <div className="bg-card border-0 md:border rounded-3xl p-0 md:p-8 md:shadow-sm animate-in fade-in duration-300">
            <div className="mb-8 border-b pb-4 hidden md:block">
              <h2 className="text-2xl font-black">{activeTabData?.label}</h2>
              <p className="text-muted-foreground mt-1">{activeTabData?.desc}</p>
            </div>
            
            {activeTab === 'account' && renderAccount()}
            {activeTab === 'children' && renderChildren()}
            {activeTab === 'credits' && renderCredits()}
            {activeTab === 'suggestions' && renderSuggestions()}
            {activeTab === 'contact' && renderContact()}
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full min-h-[400px] border-2 border-dashed rounded-3xl text-muted-foreground p-8 text-center">
            <Settings className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-xl font-bold">Select a Setting</h3>
            <p className="text-sm mt-2 max-w-xs">Choose an option from the left menu to manage your account and preferences.</p>
          </div>
        )}
      </div>

    </div>
  );
}
