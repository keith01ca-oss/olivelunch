'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { 
  Printer, Tag, MapPin, ChefHat, FileText, Calendar, 
  DollarSign, ShoppingBag, Users, Scale, TrendingUp, Loader2, Search, ArrowRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { getReportData, getOutstandingCredits } from '@/app/admin/reports/actions';

type Tab = 'daily' | 'bi';
type ReportType = 'sold' | 'orders' | 'ingredients' | 'revenue' | 'credits' | 'schools';

export default function ReportsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [reportType, setReportType] = useState<ReportType>('sold');
  
  // Date states
  const getTodayVancouver = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  };
  
  const todayVal = getTodayVancouver();
  const tomorrowVal = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  });
  const [endDate, setEndDate] = useState(todayVal);
  
  // Data states
  const [orders, setOrders] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    try {
      if (reportType === 'credits') {
        const data = await getOutstandingCredits();
        setCredits(data);
      } else {
        const data = await getReportData(startDate, endDate);
        setOrders(data.orders);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, reportType]);

  // Set date ranges via presets
  const applyPreset = (days: number) => {
    const today = new Date();
    const end = today.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
    
    const startObj = new Date();
    startObj.setDate(startObj.getDate() - days);
    const start = startObj.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
    
    setStartDate(start);
    setEndDate(end);
  };

  const applyThisMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    setStartDate(`${year}-${month}-01`);
    setEndDate(today.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }));
  };

  // --- Reports calculations ---
  
  // 1. Sold Report
  const soldReport = useMemo(() => {
    const map = new Map<string, { name: string; category: string; qty: number; revenue: number; price: number }>();
    for (const order of orders) {
      for (const item of order.order_items || []) {
        const name = item.dishes?.name || 'Unknown Dish';
        const category = item.dishes?.category || 'main';
        const qty = Number(item.quantity) || 0;
        const revenue = Number(item.total_price) || 0;
        const price = Number(item.unit_price) || 0;

        const key = `${name}_${category}`;
        if (!map.has(key)) {
          map.set(key, { name, category, qty: 0, revenue: 0, price });
        }
        const val = map.get(key)!;
        val.qty += qty;
        val.revenue += revenue;
      }
    }
    return Array.from(map.values())
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.qty - a.qty);
  }, [orders, searchQuery]);

  // 2. Ingredient Report
  const ingredientReport = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; qty: number }>();
    for (const order of orders) {
      for (const item of order.order_items || []) {
        const dish = item.dishes;
        if (!dish || !dish.ingredients) continue;
        const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
        for (const ing of ingredients) {
          const ingName = ing.name || 'Unknown Ingredient';
          const unit = ing.unit || 'pcs';
          
          const amountStr = item.is_large ? (ing.large_amount || ing.amount) : ing.amount;
          const amount = Number(amountStr) || 0;
          const totalAmt = amount * (Number(item.quantity) || 0);

          const key = `${ingName.toLowerCase()}_${unit.toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, { name: ingName, unit, qty: 0 });
          }
          map.get(key)!.qty += totalAmt;
        }
      }
    }
    return Array.from(map.values())
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, searchQuery]);

  // 3. Revenue Report
  const revenueReport = useMemo(() => {
    const map = new Map<string, { date: string; count: number; gross: number; credit: number; cash: number }>();
    for (const order of orders) {
      const date = order.order_date;
      const gross = Number(order.gross_amount) || 0;
      const credit = Number(order.credit_used) || 0;
      const cash = Number(order.total_amount) || 0;

      if (!map.has(date)) {
        map.set(date, { date, count: 0, gross: 0, credit: 0, cash: 0 });
      }
      const val = map.get(date)!;
      val.count += 1;
      val.gross += gross;
      val.credit += credit;
      val.cash += cash;
    }
    return Array.from(map.values())
      .filter(row => row.date.includes(searchQuery))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, searchQuery]);

  // 4. School Stats
  const schoolStatsReport = useMemo(() => {
    const map = new Map<string, { school: string; division: string; count: number; revenue: number }>();
    for (const order of orders) {
      const school = order.children?.schools?.name || 'Unknown School';
      const division = order.children?.division || 'Unknown';
      const revenue = Number(order.total_amount) || 0;

      const key = `${school}_${division}`;
      if (!map.has(key)) {
        map.set(key, { school, division, count: 0, revenue: 0 });
      }
      const val = map.get(key)!;
      val.count += 1;
      val.revenue += revenue;
    }
    return Array.from(map.values())
      .filter(row => row.school.toLowerCase().includes(searchQuery.toLowerCase()) || row.division.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, searchQuery]);

  // 5. Orders Filtered
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const childName = o.children?.name || '';
      const schoolName = o.children?.schools?.name || '';
      const division = o.children?.division || '';
      const matchesSearch = 
        childName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        schoolName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        division.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.id.includes(searchQuery);
      return matchesSearch;
    });
  }, [orders, searchQuery]);

  // 6. Outstanding Credits Filtered
  const filteredCredits = useMemo(() => {
    return credits.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [credits, searchQuery]);

  // General Totals
  const totals = useMemo(() => {
    let gross = 0;
    let credit = 0;
    let cash = 0;
    let items = 0;
    for (const order of orders) {
      gross += Number(order.gross_amount) || 0;
      credit += Number(order.credit_used) || 0;
      cash += Number(order.total_amount) || 0;
      for (const item of order.order_items || []) {
        items += Number(item.quantity) || 0;
      }
    }
    return { gross, credit, cash, ordersCount: orders.length, items };
  }, [orders]);

  const handlePrint = () => {
    window.print();
  };

  const dailyReports = [
    {
      title: 'Kitchen Prep Sheet',
      description: 'Scaled ingredient totals and assembly counts for the kitchen team. Print before cooking begins.',
      icon: ChefHat,
      color: 'from-orange-500 to-amber-400',
      lightColor: 'bg-orange-50 border-orange-200',
      iconBg: 'bg-orange-100 text-orange-600',
      href: `/admin/kitchen?date=${tomorrowVal}&tab=prep`,
      badge: 'Daily',
    },
    {
      title: 'Packing Labels',
      description: 'Avery 5160 compatible labels — 1 label per item, color-coded by classroom for fast sorting.',
      icon: Tag,
      color: 'from-pink-500 to-rose-400',
      lightColor: 'bg-pink-50 border-pink-200',
      iconBg: 'bg-pink-100 text-pink-600',
      href: `/admin/kitchen?date=${tomorrowVal}&tab=labels`,
      badge: 'Avery 5160',
    },
    {
      title: 'Delivery Manifest',
      description: 'Per-classroom summary for delivery drivers. Shows exactly how many meals go to each room.',
      icon: MapPin,
      color: 'from-blue-500 to-cyan-400',
      lightColor: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-600',
      href: `/admin/kitchen?date=${tomorrowVal}&tab=manifest`,
      badge: 'Driver Copy',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          aside, nav, header, button, .no-print, input, .quick-jump {
            display: none !important;
          }
          main, .print-area {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-area table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-area th, .print-area td {
            border: 1px solid #ccc !important;
            padding: 8px !important;
            text-align: left !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Reports &amp; Printing</h1>
          <p className="text-muted-foreground mt-1">
            Access daily kitchen documents or analyze interactive sales, ingredients, and financial statistics.
          </p>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-border/80 gap-2 pb-px overflow-x-auto no-print">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'daily'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Printer className="w-4 h-4" />
          Daily Printables
        </button>
        <button
          onClick={() => setActiveTab('bi')}
          className={`px-4 py-2.5 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'bi'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Interactive Business Reports
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-fade-in no-print">
          {/* Quick Date Links */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm quick-jump">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Date Jump</h2>
            <div className="flex gap-3 flex-wrap">
              {['Today', 'Tomorrow', '+2 Days', '+3 Days'].map((label, i) => {
                const date = format(addDays(new Date(), i), 'yyyy-MM-dd');
                const displayDate = format(addDays(new Date(), i), 'MMM d');
                return (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
                    <span className="text-xs font-bold text-foreground bg-muted px-3 py-1 rounded-lg">{displayDate}</span>
                    <div className="flex gap-1 mt-0.5">
                      <Link href={`/admin/kitchen?date=${date}&tab=prep`} className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded hover:bg-orange-100 transition-colors">Prep</Link>
                      <Link href={`/admin/kitchen?date=${date}&tab=labels`} className="text-[9px] font-bold text-pink-600 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded hover:bg-pink-100 transition-colors">Labels</Link>
                      <Link href={`/admin/kitchen?date=${date}&tab=manifest`} className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">Manifest</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dailyReports.map((report) => {
              const Icon = report.icon;
              return (
                <Link
                  key={report.title}
                  href={report.href}
                  className={`group relative bg-card border-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden ${report.lightColor}`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-gradient-to-br ${report.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${report.iconBg} shadow-sm`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/70 border px-2 py-0.5 rounded-full text-muted-foreground">
                      {report.badge}
                    </span>
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="text-lg font-black leading-tight">{report.title}</h3>
                    <p className="text-sm text-muted-foreground leading-snug">{report.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Printer className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="group-hover:underline">Open &amp; Print</span>
                    <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="bg-muted/30 border border-dashed rounded-2xl p-6 flex gap-4 items-start">
            <FileText className="w-6 h-6 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm">Printing Tips</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Click any card above to open the print-ready view, then use <kbd className="bg-background border rounded px-1 py-0.5 text-xs font-mono">Ctrl+P</kbd> to print.</li>
                <li>For <strong>Packing Labels</strong>, disable "Headers &amp; Footers" in Chrome's print dialog to remove the URL/timestamp lines.</li>
                <li>Labels are sized for <strong>Avery 5160</strong> — 30 per sheet, 3 columns × 10 rows.</li>
                <li>Set Color mode to <strong>Color</strong> in the print dialog to preserve classroom color-coding.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bi' && (
        <div className="space-y-6 animate-fade-in">
          {/* Report configuration filters */}
          <div className="bg-card border rounded-3xl p-6 shadow-sm space-y-4 no-print">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-slate-800 text-sm">Date Range Configuration</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => applyPreset(1)} className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-lg font-bold">Yesterday</button>
                <button onClick={() => applyPreset(7)} className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-lg font-bold">Last 7 Days</button>
                <button onClick={() => applyPreset(30)} className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-lg font-bold">Last 30 Days</button>
                <button onClick={applyThisMonth} className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 rounded-lg font-bold">This Month</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-10 border rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-10 border rounded-xl px-3 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Search Filter</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search results..."
                    className="w-full h-10 border rounded-xl pl-9 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none bg-background font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Report Selection */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar selection */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-1.5 no-print">
              {[
                { id: 'sold', label: 'Items Sold Report', icon: ShoppingBag, desc: 'Quantities and sales per dish' },
                { id: 'ingredients', label: 'Ingredient Usage', icon: Scale, desc: 'Aggregated raw ingredient needs' },
                { id: 'revenue', label: 'Revenue & Cash Flow', icon: DollarSign, desc: 'Sales, credit, and cash audit' },
                { id: 'orders', label: 'Detailed Orders List', icon: FileText, desc: 'Audit log of paid orders' },
                { id: 'credits', label: 'Outstanding Credits', icon: Users, desc: 'Outstanding credit balances' },
                { id: 'schools', label: 'School Stats', icon: MapPin, desc: 'Orders breakdown by school/division' },
              ].map(rep => {
                const Icon = rep.icon;
                return (
                  <button
                    key={rep.id}
                    onClick={() => {
                      setReportType(rep.id as ReportType);
                      setSearchQuery('');
                    }}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                      reportType === rep.id
                        ? 'border-primary bg-primary/5 text-primary shadow-sm font-extrabold'
                        : 'border-border/60 hover:bg-muted bg-card'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold leading-tight">{rep.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug font-medium">{rep.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Main Report View Area */}
            <div className="flex-1 bg-card border rounded-3xl p-6 shadow-sm min-w-0 print-area">
              {/* Report Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight capitalize">
                    {reportType === 'sold' && 'Dishes Sold Report'}
                    {reportType === 'ingredients' && 'Ingredient Usage Report'}
                    {reportType === 'revenue' && 'Revenue & Financial Audit'}
                    {reportType === 'orders' && 'Detailed Orders List'}
                    {reportType === 'credits' && 'Parent Store Credit Liability'}
                    {reportType === 'schools' && 'School Ordering Statistics'}
                  </h2>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">
                    {reportType === 'credits' ? (
                      'Aggregated active store credit liabilities across all registered parents.'
                    ) : (
                      <>Date range: <strong className="text-foreground">{startDate}</strong> to <strong className="text-foreground">{endDate}</strong></>
                    )}
                  </p>
                </div>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 border rounded-xl bg-card hover:bg-muted text-xs font-bold text-slate-700 transition-colors shadow-sm no-print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Report
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground">Generating report data...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Revenue Summary Cards (Only for Revenue/BI overview) */}
                  {reportType === 'revenue' && !searchQuery && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 no-print">
                      <div className="border rounded-2xl p-4 bg-slate-50">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Orders</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{totals.ordersCount}</p>
                      </div>
                      <div className="border rounded-2xl p-4 bg-slate-50">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Gross Sales</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">${totals.gross.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-2xl p-4 bg-slate-50">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Credits Applied</p>
                        <p className="text-2xl font-black text-green-600 mt-1">${totals.credit.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-2xl p-4 bg-primary/5 border-primary/25">
                        <p className="text-[10px] text-primary font-bold uppercase">Net Cash (Stripe)</p>
                        <p className="text-2xl font-black text-primary mt-1">${totals.cash.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  {/* 1. SOLD REPORT TABLE */}
                  {reportType === 'sold' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">Dish Name</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Category</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Units Sold</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Unit Price (avg)</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {soldReport.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-muted-foreground font-medium">No sales matches found in range.</td>
                            </tr>
                          ) : (
                            soldReport.map((item, idx) => (
                              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                                <td className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.category}</td>
                                <td className="py-3 px-4 font-bold text-slate-900 text-right">{item.qty}</td>
                                <td className="py-3 px-4 font-medium text-slate-700 text-right">${(item.revenue / (item.qty || 1)).toFixed(2)}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-950 text-right">${item.revenue.toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {soldReport.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 font-black bg-slate-50">
                              <td className="py-3 px-4">Total</td>
                              <td className="py-3 px-4"></td>
                              <td className="py-3 px-4 text-right">{soldReport.reduce((sum, item) => sum + item.qty, 0)}</td>
                              <td className="py-3 px-4 text-right"></td>
                              <td className="py-3 px-4 text-right text-base">${soldReport.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {/* 2. INGREDIENTS TABLE */}
                  {reportType === 'ingredients' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">Ingredient Name</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Total Scaled Needs</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Measurement Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ingredientReport.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-10 text-muted-foreground font-medium">No ingredient records found for dates.</td>
                            </tr>
                          ) : (
                            ingredientReport.map((item, idx) => (
                              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900 capitalize">{item.name}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-900 text-right">{Math.round(item.qty * 1000) / 1000}</td>
                                <td className="py-3 px-4 font-semibold text-muted-foreground">{item.unit}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 3. REVENUE AUDIT TABLE */}
                  {reportType === 'revenue' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">Order Date</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Orders Count</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Gross Sales</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Credits Used</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Cash Recd (Stripe)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {revenueReport.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-muted-foreground font-medium">No financial details available.</td>
                            </tr>
                          ) : (
                            revenueReport.map((row, idx) => (
                              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900">{row.date}</td>
                                <td className="py-3 px-4 font-medium text-slate-600 text-right">{row.count}</td>
                                <td className="py-3 px-4 font-bold text-slate-900 text-right">${row.gross.toFixed(2)}</td>
                                <td className="py-3 px-4 text-green-600 font-semibold text-right">-${row.credit.toFixed(2)}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-950 text-right">${row.cash.toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {revenueReport.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 font-black bg-slate-50">
                              <td className="py-3 px-4">Total</td>
                              <td className="py-3 px-4 text-right">{totals.ordersCount}</td>
                              <td className="py-3 px-4 text-right">${totals.gross.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right text-green-600">-${totals.credit.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right text-base text-primary">${totals.cash.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {/* 4. DETAILED ORDERS TABLE */}
                  {reportType === 'orders' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">Order ID</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Meal Date</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Child</th>
                            <th className="py-3 px-4 font-bold text-slate-800">School / Div</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Cash Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-muted-foreground font-medium">No matching orders found.</td>
                            </tr>
                          ) : (
                            filteredOrders.map((o) => (
                              <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 text-[10px] font-mono text-muted-foreground max-w-[120px] truncate">{o.id}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{o.order_date}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{o.children?.name}</td>
                                <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                                  {o.children?.schools?.name} · {o.children?.division}
                                </td>
                                <td className="py-3 px-4 font-extrabold text-slate-900 text-right">${Number(o.total_amount).toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 5. OUTSTANDING CREDITS TABLE */}
                  {reportType === 'credits' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">Parent Name</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Email Address</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Credit Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredCredits.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-10 text-muted-foreground font-medium">No parent credits found.</td>
                            </tr>
                          ) : (
                            filteredCredits.map((c) => (
                              <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                                <td className="py-3 px-4 font-medium text-slate-700">
                                  <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>
                                </td>
                                <td className="py-3 px-4 font-extrabold text-green-600 text-right">${c.balance.toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {filteredCredits.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 font-black bg-slate-50">
                              <td className="py-3 px-4">Total Liability</td>
                              <td className="py-3 px-4"></td>
                              <td className="py-3 px-4 text-right text-base text-green-600">
                                ${filteredCredits.reduce((sum, c) => sum + c.balance, 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {/* 6. SCHOOL STATS TABLE */}
                  {reportType === 'schools' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="py-3 px-4 font-bold text-slate-800">School Name</th>
                            <th className="py-3 px-4 font-bold text-slate-800">Classroom / Division</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Orders Count</th>
                            <th className="py-3 px-4 font-bold text-slate-800 text-right">Total Cash Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {schoolStatsReport.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center py-10 text-muted-foreground font-medium">No school statistics found in range.</td>
                            </tr>
                          ) : (
                            schoolStatsReport.map((row, idx) => (
                              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900">{row.school}</td>
                                <td className="py-3 px-4 font-semibold text-slate-700">{row.division}</td>
                                <td className="py-3 px-4 font-medium text-slate-600 text-right">{row.count}</td>
                                <td className="py-3 px-4 font-extrabold text-slate-950 text-right">${row.revenue.toFixed(2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {schoolStatsReport.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 font-black bg-slate-50">
                              <td className="py-3 px-4">Total</td>
                              <td className="py-3 px-4"></td>
                              <td className="py-3 px-4 text-right">{schoolStatsReport.reduce((sum, r) => sum + r.count, 0)}</td>
                              <td className="py-3 px-4 text-right text-base">${schoolStatsReport.reduce((sum, r) => sum + r.revenue, 0).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
