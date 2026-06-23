'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Search, Download, FileText, CheckCircle, Clock, XCircle, 
  RefreshCcw, ChevronDown, ChevronUp, Trash2, Check, MoreVertical,
  AlertCircle, Truck, Edit3, Plus
} from 'lucide-react';
import { updateOrderStatuses, deleteOrdersAdmin } from '@/app/admin/orders/actions';
import EditOrderModal from '@/components/admin/EditOrderModal';
import AddOrderModal from '@/components/admin/AddOrderModal';

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  dishes: { id: string; name: string; category: string } | null;
}

interface Order {
  id: string;
  order_date: string;
  status: OrderStatus;
  gross_amount: number;
  total_amount: number;
  created_at: string;
  children: { 
    id: string; 
    name: string; 
    division: string;
    schools: {
      name: string;
      school_routes: {
        stop_order: number;
        routes: {
          route_number: string;
        } | null;
      }[] | null;
    } | null;
  } | null;
  parents: { id: string; name: string; email: string } | null;
  order_items: OrderItem[];
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  paid:       { label: 'Paid',       color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  cancelled:  { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200',         icon: <XCircle className="w-3.5 h-3.5" /> },
  refunded:   { label: 'Refunded',  color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: <RefreshCcw className="w-3.5 h-3.5" /> },
};

export default function OrdersClient({ 
  initialOrders, orgId, dishes, childrenList 
}: { 
  initialOrders: Order[]; orgId?: string; dishes?: any[]; childrenList?: any[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'school' | 'route' | 'child'>('date');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      const matchSearch = !search ||
        o.children?.name.toLowerCase().includes(search.toLowerCase()) ||
        o.parents?.name.toLowerCase().includes(search.toLowerCase()) ||
        o.parents?.email.toLowerCase().includes(search.toLowerCase()) ||
        o.children?.schools?.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchDate = !dateFilter || o.order_date === dateFilter;
      return matchSearch && matchStatus && matchDate;
    });

    return result.sort((a, b) => {
      if (sortBy === 'date') return b.order_date.localeCompare(a.order_date);
      if (sortBy === 'school') return (a.children?.schools?.name || '').localeCompare(b.children?.schools?.name || '');
      if (sortBy === 'child') return (a.children?.name || '').localeCompare(b.children?.name || '');
      if (sortBy === 'route') {
        const ra = a.children?.schools?.school_routes?.[0]?.routes?.route_number || '';
        const rb = b.children?.schools?.school_routes?.[0]?.routes?.route_number || '';
        return ra.localeCompare(rb);
      }
      return 0;
    });
  }, [orders, search, statusFilter, dateFilter, sortBy]);

  const updateStatus = async (ids: string[], newStatus: OrderStatus) => {
    if (ids.length === 0) return;
    setIsUpdating(true);
    try {
      const res = await updateOrderStatuses(ids, newStatus);
      if (res.error) throw new Error(res.error);

      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: newStatus } : o));
      if (ids.length > 1) setSelectedIds(new Set());
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteOrders = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} order(s)? This cannot be undone.`)) return;
    setIsUpdating(true);
    try {
      const res = await deleteOrdersAdmin(ids);
      if (res.error) throw new Error(res.error);

      setOrders(prev => prev.filter(o => !ids.includes(o.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete orders');
    } finally {
      setIsUpdating(false);
    }
  };

  const stats = useMemo(() => ({
    total: orders.length,
    paid: orders.filter(o => o.status === 'paid').length,
    pending: orders.filter(o => o.status === 'pending').length,
    revenue: orders.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.total_amount), 0),
  }), [orders]);

  const exportCSV = () => {
    const rows = [['Date', 'School', 'Route', 'Child', 'Division', 'Parent', 'Email', 'Item Name', 'Qty', 'Status', 'Total']];
    filtered.forEach(o => {
      const school = o.children?.schools?.name || '';
      const route = o.children?.schools?.school_routes?.[0]?.routes?.route_number || '';
      o.order_items.forEach(item => {
        rows.push([o.order_date, school, route, o.children?.name || '', o.children?.division || '', o.parents?.name || '', o.parents?.email || '', item.dishes?.name || 'Unknown', item.quantity.toString(), o.status, `$${Number(item.total_price).toFixed(2)}`]);
      });
      if (o.order_items.length === 0) {
        rows.push([o.order_date, school, route, o.children?.name || '', o.children?.division || '', o.parents?.name || '', o.parents?.email || '', 'NO ITEMS', '0', o.status, `$${Number(o.total_amount).toFixed(2)}`]);
      }
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `orders-items-${dateFilter || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printLabels = () => {
    const paidOrders = filtered.filter(o => o.status === 'paid');
    if (paidOrders.length === 0) { alert('No paid orders to print.'); return; }
    const labelItems: any[] = [];
    paidOrders.forEach(o => {
      o.order_items.forEach(item => {
        labelItems.push({ 
          order: o, 
          item, 
          school: o.children?.schools?.name || '', 
          route: o.children?.schools?.school_routes?.[0]?.routes?.route_number || '',
          stopOrder: o.children?.schools?.school_routes?.[0]?.stop_order || 0
        });
      });
    });

    // Sort labels for production efficiency: Dish Name > School > Date > Route
    labelItems.sort((a, b) => {
      const dishA = a.item.dishes?.name || '';
      const dishB = b.item.dishes?.name || '';
      if (dishA !== dishB) return dishA.localeCompare(dishB);
      
      if (a.school !== b.school) return a.school.localeCompare(b.school);
      
      if (a.order.order_date !== b.order.order_date) return a.order.order_date.localeCompare(b.order.order_date);
      
      return a.route.localeCompare(b.route);
    });

    const html = `<!DOCTYPE html><html><head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; } 
        body { font-family: Arial, sans-serif; } 
        .page { width: 8.125in; margin: 0 auto; } 
        .grid { display: grid; grid-template-columns: repeat(3, 2.625in); grid-auto-rows: 1in; column-gap: 0.125in; row-gap: 0; }
        .label { width: 2.625in; height: 1in; padding: 0.1in 0.15in; border: 1px dashed #ccc; display: flex; flex-direction: column; justify-content: center; overflow: hidden; page-break-inside: avoid; }
        .row { display: flex; justify-content: space-between; align-items: baseline; white-space: nowrap; overflow: hidden; }
        .main-text { font-size: 12px; font-weight: 900; text-overflow: ellipsis; overflow: hidden; }
        .date-text { font-size: 9px; font-weight: bold; color: #555; margin-left: 4px; }
        .school-row { font-size: 10px; color: #333; text-overflow: ellipsis; overflow: hidden; justify-content: flex-start; margin-top: 2px; margin-bottom: 3px; font-weight: 600;}
        .dish-row { font-size: 12px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; justify-content: flex-start; border-top: 1px solid #ddd; padding-top: 3px;}
        @media print { .label { border: none; } @page { margin: 0.5in 0.1875in; size: 8.5in 11in; } }
      </style></head><body><div class="page"><div class="grid">${labelItems.map(li => `
        <div class="label">
          <div class="row">
            <span class="main-text">${li.order.children?.division || ''} - ${li.order.children?.name || 'Unknown'}</span>
            <span class="date-text">${new Date(li.order.order_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
          </div>
          <div class="row school-row">
            ${li.route ? `Route ${li.route}` : 'No Route'} - ${li.school}
          </div>
          <div class="row dish-row">
            ${li.item.quantity}x ${li.item.dishes?.name || ''}
          </div>
        </div>`).join('')}</div></div><script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const printDriverManifest = () => {
    const paidOrders = filtered.filter(o => o.status === 'paid');
    if (paidOrders.length === 0) { alert('No paid orders to print.'); return; }

    // Organize data: Route -> Stop Order -> School -> Dish Name -> Total Qty
    type ManifestMap = Record<string, {
      route: string;
      stops: Record<string, {
        stopOrder: number;
        schoolName: string;
        dishes: Record<string, number>;
      }>;
    }>;

    const manifest: ManifestMap = {};

    paidOrders.forEach(o => {
      const schoolName = o.children?.schools?.name || 'Unknown School';
      const routeName = o.children?.schools?.school_routes?.[0]?.routes?.route_number || 'Unassigned Route';
      const stopOrder = o.children?.schools?.school_routes?.[0]?.stop_order || 0;

      if (!manifest[routeName]) {
        manifest[routeName] = { route: routeName, stops: {} };
      }
      
      const stopKey = `${stopOrder}-${schoolName}`;
      if (!manifest[routeName].stops[stopKey]) {
        manifest[routeName].stops[stopKey] = { stopOrder, schoolName, dishes: {} };
      }

      o.order_items.forEach(item => {
        const dishName = item.dishes?.name || 'Unknown Dish';
        manifest[routeName].stops[stopKey].dishes[dishName] = (manifest[routeName].stops[stopKey].dishes[dishName] || 0) + item.quantity;
      });
    });

    // Generate HTML
    let pagesHtml = '';
    const sortedRoutes = Object.values(manifest).sort((a, b) => a.route.localeCompare(b.route));

    sortedRoutes.forEach(routeObj => {
      let routeTotalBoxes = 0;

      const sortedStops = Object.values(routeObj.stops).sort((a, b) => {
        if (a.stopOrder !== b.stopOrder) return a.stopOrder - b.stopOrder;
        return a.schoolName.localeCompare(b.schoolName);
      });

      // Pre-calculate route total boxes
      sortedStops.forEach(stop => {
        Object.values(stop.dishes).forEach(qty => {
          routeTotalBoxes += qty;
        });
      });

      pagesHtml += `
        <div class="page">
          <div class="header">
            <h1>DRIVER MANIFEST - Route ${routeObj.route}</h1>
            <p><strong>Delivery Date:</strong> ${dateFilter ? new Date(dateFilter).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'All Dates (Not Filtered)'}</p>
            <p style="font-size: 18px; margin-top: 10px;"><strong>TOTAL ROUTE BOXES: ${routeTotalBoxes}</strong></p>
          </div>
          <div class="stops">
            ${sortedStops.map(stop => {
              const sortedDishes = Object.keys(stop.dishes).sort();
              const stopTotalBoxes = Object.values(stop.dishes).reduce((sum, qty) => sum + qty, 0);
              
              return `
                <div class="stop-box">
                  <div class="stop-header">
                    <h2 style="display: flex; justify-content: space-between; align-items: center;">
                      <span>Stop ${stop.stopOrder}: ${stop.schoolName}</span>
                      <span style="font-size: 14px; background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Total Boxes: ${stopTotalBoxes}</span>
                    </h2>
                  </div>
                  <div class="dish-list">
                    ${sortedDishes.map(dish => `
                      <div class="dish-item">
                        <div class="checkbox"></div>
                        <span class="qty">${stop.dishes[dish]}x</span> <span class="dish-name">${dish}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    const html = `<!DOCTYPE html><html><head><style>
        * { box-sizing: border-box; } 
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
        .page { width: 8.5in; min-height: 11in; padding: 0.5in; margin: 0 auto; page-break-after: always; }
        .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { margin: 0 0 5px 0; font-size: 24px; text-transform: uppercase; }
        .header p { margin: 0; font-size: 14px; color: #444; }
        .stop-box { border: 2px solid #ccc; border-radius: 8px; margin-bottom: 20px; break-inside: avoid; }
        .stop-header { background: #f4f4f4; padding: 10px 15px; border-bottom: 2px solid #ccc; border-top-left-radius: 6px; border-top-right-radius: 6px; }
        .stop-header h2 { margin: 0; font-size: 18px; }
        .dish-list { padding: 15px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .dish-item { display: flex; align-items: center; font-size: 16px; font-weight: bold; }
        .checkbox { width: 20px; height: 20px; border: 2px solid #000; margin-right: 10px; border-radius: 3px; }
        .qty { color: #d97706; margin-right: 6px; width: 35px; display: inline-block; text-align: right; }
        @media print { body { background: none; } .page { padding: 0.25in; margin: 0; box-shadow: none; page-break-after: always; } }
      </style></head><body>${pagesHtml}<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script></body></html>`;
      
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: stats.total, color: 'text-foreground' },
          { label: 'Paid', value: stats.paid, color: 'text-green-600' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}`, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, school, email..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-input bg-card text-sm focus:ring-1 focus:ring-primary outline-none shadow-sm"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <input
            type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-sm focus:ring-1 focus:ring-primary outline-none shadow-sm"
          />
          
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-sm focus:ring-1 focus:ring-primary outline-none shadow-sm">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-sm font-semibold text-primary focus:ring-1 focus:ring-primary outline-none shadow-sm">
            <option value="date">Sort: Date</option>
            <option value="school">Sort: School</option>
            <option value="route">Sort: Route</option>
            <option value="child">Sort: Child Name</option>
          </select>

          <button onClick={() => setIsAddingOrder(true)} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Order
          </button>

          <button onClick={exportCSV} className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          
          <button onClick={printDriverManifest} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm">
            <Truck className="w-4 h-4" /> Print Manifest
          </button>

          <button onClick={printLabels} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Print Labels
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-50 flex items-center justify-between bg-primary text-primary-foreground px-6 py-3 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm">{selectedIds.size} orders selected</span>
            <div className="h-4 w-px bg-primary-foreground/20" />
            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateStatus(Array.from(selectedIds), 'paid')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
              </button>
              <button 
                onClick={() => updateStatus(Array.from(selectedIds), 'pending')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
              >
                <Clock className="w-3.5 h-3.5" /> Mark Pending
              </button>
              <button 
                onClick={() => updateStatus(Array.from(selectedIds), 'cancelled')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => deleteOrders(Array.from(selectedIds))}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 bg-muted/40 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-input accent-primary"
            />
            <span className="text-sm font-semibold">{filtered.length} orders total</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No orders found.</div>
        ) : (
          <div className="divide-y">
            {filtered.map(order => {
              const isExpanded = expandedIds.has(order.id);
              const isSelected = selectedIds.has(order.id);
              const cfg = STATUS_CONFIG[order.status];
              const school = order.children?.schools?.name || 'No School';
              const route = order.children?.schools?.school_routes?.[0]?.routes?.route_number || '—';
              
              return (
                <div key={order.id} className={isSelected ? 'bg-primary/5' : ''}>
                  {/* Order Row */}
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelected(order.id)}
                      className="w-4 h-4 rounded border-input accent-primary shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpanded(order.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{order.children?.name || '—'}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-bold">{order.children?.division}</span>
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Route {route}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold text-foreground">{school}</span> · {order.parents?.name}
                      </div>
                      
                      <div className="mt-2 text-xs font-medium text-primary line-clamp-1">
                        {order.order_items.length > 0 
                          ? order.order_items.map(i => {
                              const name = (i.is_large && i.dishes?.large_name) ? i.dishes.large_name : i.dishes?.name;
                              return `${i.quantity}x ${name}`;
                            }).join(', ')
                          : 'No items in order'}
                      </div>
                    </div>
                    
                    <div className="text-sm font-medium text-muted-foreground shrink-0">{order.order_date}</div>
                    
                    {/* Interactive Status Dropdown */}
                    <div className="relative group shrink-0">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus([order.id], e.target.value as OrderStatus)}
                        className={`appearance-none flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.color} cursor-pointer hover:brightness-95 transition-all outline-none pr-8`}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="refunded">Refunded</option>
                      </select>
                      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-60`} />
                    </div>
                    
                    <div className="text-sm font-black shrink-0 w-16 text-right">${Number(order.total_amount).toFixed(2)}</div>
                    
                    <button onClick={() => toggleExpanded(order.id)} className="text-muted-foreground p-1 hover:bg-muted rounded-lg transition-colors shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded Items */}
                  {isExpanded && (
                    <div className="bg-muted/20 px-8 py-4 border-t border-muted">
                      <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Breakdown</p>
                        <button 
                          onClick={() => deleteOrders([order.id])}
                          className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Order
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {order.order_items.map(item => {
                          const displayName = (item.is_large && item.dishes?.large_name) ? item.dishes.large_name : (item.dishes?.name || 'Unknown');
                          return (
                          <div key={item.id} className="flex items-center gap-3 text-sm">
                            <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0">{item.quantity}</span>
                            <div className="flex-1">
                              <p className="font-bold">{displayName}{item.is_large && <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-bold uppercase">Large</span>}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">{item.dishes?.category}</p>
                            </div>
                            <span className="font-bold text-muted-foreground">${Number(item.unit_price).toFixed(2)}</span>
                            <span className="font-black w-16 text-right">${Number(item.total_price).toFixed(2)}</span>
                          </div>
                        )})}
                      </div>
                      <div className="mt-4 pt-4 border-t border-muted/50 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                          <p>Order ID: <span className="font-mono">{order.id}</span></p>
                          <p>Email: {order.parents?.email}</p>
                          <p>Placed: {new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-end gap-6">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg shadow-sm hover:bg-secondary/80 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit / Refund
                          </button>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground font-bold">Order Total</p>
                            <p className="text-xl font-black text-primary">${Number(order.total_amount).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingOrder && (
        <EditOrderModal 
          order={editingOrder}
          dishes={dishes || []}
          onClose={() => {
            setEditingOrder(null);
            window.location.reload();
          }} 
        />
      )}

      {isAddingOrder && (
        <AddOrderModal
          orgId={orgId!}
          dishes={dishes || []}
          childrenList={childrenList || []}
          onClose={() => setIsAddingOrder(false)}
          onSuccess={() => {
            setIsAddingOrder(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
