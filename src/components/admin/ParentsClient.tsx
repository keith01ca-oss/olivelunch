'use client';

import { useState, useMemo } from 'react';
import { Search, Star, StarOff, CreditCard, Users, ChevronDown, ChevronUp, Copy, Check, Mail, Send, X } from 'lucide-react';
import { addManualCredit, toggleVipStatus, broadcastEmail } from '@/app/admin/parents/actions';
import { format } from 'date-fns';

interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_vip: boolean;
  referral_code: string | null;
  created_at: string;
  childrenCount: number;
  creditBalance: number;
  totalOrders: number;
  paidOrders: number;
}

export default function ParentsClient({ parents: initialParents }: { parents: Parent[] }) {
  const [parents, setParents] = useState<Parent[]>(initialParents);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'vip' | 'credit'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Email Broadcast State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const filtered = useMemo(() => {
    let list = parents;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }
    if (filter === 'vip') list = list.filter(p => p.is_vip);
    if (filter === 'credit') list = list.filter(p => p.creditBalance > 0);
    return list;
  }, [parents, search, filter]);

  const handleAddCredit = async (parentId: string) => {
    const raw = creditAmounts[parentId];
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount === 0) return alert('Enter a valid amount (use negative to deduct)');
    setLoadingId(parentId);
    const res = await addManualCredit(parentId, amount, '');
    setLoadingId(null);
    if (res.error) return alert(res.error);
    setParents(prev => prev.map(p => p.id === parentId ? { ...p, creditBalance: p.creditBalance + amount } : p));
    setCreditAmounts(prev => ({ ...prev, [parentId]: '' }));
  };

  const handleToggleVip = async (parentId: string, current: boolean) => {
    setLoadingId(parentId);
    const res = await toggleVipStatus(parentId, !current);
    setLoadingId(null);
    if (res.error) return alert(res.error);
    setParents(prev => prev.map(p => p.id === parentId ? { ...p, is_vip: !current } : p));
  };

  const handleCopyCode = (code: string, id: string) => {
    const link = `${window.location.origin}/refer/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => ({
    total: parents.length,
    vip: parents.filter(p => p.is_vip).length,
    withCredit: parents.filter(p => p.creditBalance > 0).length,
    totalCreditOut: parents.reduce((s, p) => s + (p.creditBalance > 0 ? p.creditBalance : 0), 0),
  }), [parents]);

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return alert('Subject and message are required.');
    
    // Convert newlines to <br> for simple HTML
    const htmlBody = emailBody.replace(/\n/g, '<br />');
    
    setSendingEmail(true);
    // If no specific selection, but they clicked "Email All Filtered", use the filtered list
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map(p => p.id);
    
    const res = await broadcastEmail(targetIds, emailSubject, htmlBody);
    setSendingEmail(false);
    
    if (res.error) return alert(res.error);
    
    const { sent = 0, failed = 0 } = res as any;
    alert(`Success! Sent ${sent} emails. ${failed > 0 ? `(${failed} failed)` : ''}`);
    setShowEmailModal(false);
    setEmailSubject('');
    setEmailBody('');
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parents</h1>
        <p className="text-muted-foreground mt-1">Manage parent accounts, credits, and VIP status.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Parents', value: stats.total, icon: <Users className="w-4 h-4" /> },
          { label: 'VIP Members', value: stats.vip, icon: <Star className="w-4 h-4 text-amber-500" /> },
          { label: 'With Credit', value: stats.withCredit, icon: <CreditCard className="w-4 h-4 text-green-500" /> },
          { label: 'Credits Outstanding', value: `$${stats.totalCreditOut.toFixed(2)}`, icon: <CreditCard className="w-4 h-4 text-blue-500" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              {s.icon} {s.label}
            </div>
            <p className="text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-background text-sm focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'vip', 'credit'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'}`}
            >
              {f === 'all' ? 'All' : f === 'vip' ? '⭐ VIP' : '💳 Has Credit'}
            </button>
          ))}
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Mail className="w-4 h-4" />
            {selectedIds.size > 0 ? `Email Selected (${selectedIds.size})` : `Email All (${filtered.length})`}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-4 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    ref={input => {
                      if (input) {
                        input.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length;
                      }
                    }}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left p-4 font-semibold text-muted-foreground">Parent</th>
                <th className="text-left p-4 font-semibold text-muted-foreground hidden md:table-cell">Children</th>
                <th className="text-left p-4 font-semibold text-muted-foreground hidden md:table-cell">Orders</th>
                <th className="text-left p-4 font-semibold text-muted-foreground">Credit</th>
                <th className="text-left p-4 font-semibold text-muted-foreground hidden lg:table-cell">Status</th>
                <th className="text-left p-4 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No parents found.</td></tr>
              )}
              {filtered.map(p => (
                <>
                  <tr
                    key={p.id}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelection(p.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                        {p.is_vip && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">VIP</span>}
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{p.childrenCount}</td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      <span className="text-green-700 font-semibold">{p.paidOrders}</span>
                      <span className="text-muted-foreground"> / {p.totalOrders}</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${p.creditBalance > 0 ? 'text-green-600' : p.creditBalance < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        ${p.creditBalance.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-xs text-muted-foreground">
                      Joined {format(new Date(p.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="p-4">
                      {expandedId === p.id
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </td>
                  </tr>

                  {expandedId === p.id && (
                    <tr key={`${p.id}-expanded`} className="bg-muted/20">
                      <td colSpan={7} className="p-4">
                        <div className="flex flex-wrap gap-4">

                          {/* Add / Deduct Credit */}
                          <div className="flex-1 min-w-[220px] bg-card border rounded-xl p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Adjust Credit</p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 5.00 or -2.00"
                                value={creditAmounts[p.id] || ''}
                                onChange={e => setCreditAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary"
                              />
                              <button
                                onClick={() => handleAddCredit(p.id)}
                                disabled={loadingId === p.id}
                                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                              >
                                Apply
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Current: <strong>${p.creditBalance.toFixed(2)}</strong>. Use negative to deduct.</p>
                          </div>

                          {/* VIP Toggle */}
                          <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase">VIP Status</p>
                            <button
                              onClick={() => handleToggleVip(p.id, p.is_vip)}
                              disabled={loadingId === p.id}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${p.is_vip ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-background border-input hover:bg-muted'}`}
                            >
                              {p.is_vip ? <><StarOff className="w-4 h-4" /> Remove VIP</> : <><Star className="w-4 h-4" /> Grant VIP</>}
                            </button>
                          </div>

                          {/* Referral Code */}
                          {p.referral_code && (
                            <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 space-y-2">
                              <p className="text-xs font-bold text-muted-foreground uppercase">Referral Code</p>
                              <p className="font-mono font-bold text-lg">{p.referral_code}</p>
                              <button
                                onClick={() => handleCopyCode(p.referral_code!, p.id)}
                                className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                              >
                                {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedId === p.id ? 'Copied!' : 'Copy link'}
                              </button>
                            </div>
                          )}

                          {/* Contact */}
                          <div className="flex-1 min-w-[200px] bg-card border rounded-xl p-4 space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Contact</p>
                            <p className="text-sm">{p.email}</p>
                            <p className="text-sm text-muted-foreground">{p.phone || 'No phone'}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {p.childrenCount} child{p.childrenCount !== 1 ? 'ren' : ''} · {p.paidOrders} paid orders
                            </p>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Broadcast Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border shadow-xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Broadcast Email</h2>
                  <p className="text-xs text-muted-foreground">
                    Sending to {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filtered.length} filtered`} parents
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Subject</label>
                <input 
                  type="text" 
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="e.g. Important Update from Olive Lunch"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1 flex items-center justify-between">
                  Message
                  <span className="text-xs font-normal text-muted-foreground">Use {'{name}'} to insert parent's name</span>
                </label>
                <textarea 
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Hello {name},&#10;&#10;Write your message here..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[200px] focus:ring-1 focus:ring-primary font-sans"
                />
              </div>
            </div>
            
            <div className="p-4 border-t bg-muted/30 flex justify-end gap-3">
              <button 
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
                disabled={sendingEmail}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> 
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
