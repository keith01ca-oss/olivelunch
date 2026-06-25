'use client';
import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ReferralCard({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      setLink(`${window.location.origin}/refer/${code}`);
    }
  }, [code]);

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) {
    return (
      <div className="rounded-2xl border-2 bg-card p-6 shadow-md">
        <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Referral Code</h3>
        <p className="mt-2 text-2xl font-black font-mono tracking-widest text-foreground">---</p>
        <p className="text-sm font-semibold text-slate-600 mt-1">Loading your code...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 bg-card p-6 shadow-md">
      <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Referral Code</h3>
      <p className="mt-2 text-3xl font-black font-mono tracking-widest text-primary">{code}</p>
      <p className="text-sm font-semibold text-slate-800 mt-1 mb-4">
        Refer a friend, and get <span className="font-black text-primary underline decoration-2">$5 credit</span> for every new VIP signup.
      </p>
      <button
        onClick={handleCopy}
        disabled={!link}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary text-base font-black hover:bg-primary/10 transition-all active:scale-95 disabled:opacity-50"
      >
        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        {copied ? 'Copied!' : 'Copy Referral Link'}
      </button>
    </div>
  );
}

