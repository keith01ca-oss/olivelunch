import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { Printer, Tag, MapPin, ChefHat, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const reports = [
    {
      title: 'Kitchen Prep Sheet',
      description: 'Scaled ingredient totals and assembly counts for the kitchen team. Print before cooking begins.',
      icon: ChefHat,
      color: 'from-orange-500 to-amber-400',
      lightColor: 'bg-orange-50 border-orange-200',
      iconBg: 'bg-orange-100 text-orange-600',
      href: `/admin/kitchen?date=${tomorrow}&tab=prep`,
      badge: 'Daily',
    },
    {
      title: 'Packing Labels',
      description: 'Avery 5160 compatible labels — 1 label per item, color-coded by classroom for fast sorting.',
      icon: Tag,
      color: 'from-pink-500 to-rose-400',
      lightColor: 'bg-pink-50 border-pink-200',
      iconBg: 'bg-pink-100 text-pink-600',
      href: `/admin/kitchen?date=${tomorrow}&tab=labels`,
      badge: 'Avery 5160',
    },
    {
      title: 'Delivery Manifest',
      description: 'Per-classroom summary for delivery drivers. Shows exactly how many meals go to each room.',
      icon: MapPin,
      color: 'from-blue-500 to-cyan-400',
      lightColor: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-600',
      href: `/admin/kitchen?date=${tomorrow}&tab=manifest`,
      badge: 'Driver Copy',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Reports & Printing</h1>
        <p className="text-muted-foreground mt-1">
          All printable documents for daily kitchen operations. Links default to <strong>tomorrow</strong> — you can change the date after clicking.
        </p>
      </div>

      {/* Quick Date Links */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm">
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
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.title}
              href={report.href}
              className={`group relative bg-card border-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden ${report.lightColor}`}
            >
              {/* Background gradient decoration */}
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
                <span className="group-hover:underline">Open & Print</span>
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
            <li>For <strong>Packing Labels</strong>, disable "Headers & Footers" in Chrome's print dialog to remove the URL/timestamp lines.</li>
            <li>Labels are sized for <strong>Avery 5160</strong> — 30 per sheet, 3 columns × 10 rows.</li>
            <li>Set Color mode to <strong>Color</strong> in the print dialog to preserve classroom color-coding.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
