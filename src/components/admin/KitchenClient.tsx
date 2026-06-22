'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Printer, Calendar, Download, ChefHat, Clock } from 'lucide-react';

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

interface Dish {
  id: string;
  name: string;
  category: string;
  recipe_url?: string;
  ingredients?: Ingredient[];
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  pack_time_seconds?: number;
}

interface OrderItem {
  dish_id: string;
  quantity: number;
}

interface Order {
  id: string;
  order_items: OrderItem[];
}

export default function KitchenClient({ initialDishes, initialDate, initialTab }: { 
  initialDishes: Dish[]; 
  initialDate?: string;
  initialTab?: 'prep' | 'labels' | 'manifest';
}) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'prep' | 'labels' | 'manifest'>(initialTab || 'prep');

  // Label sort state — 3 cascading sort fields
  type SortField = 'dish' | 'school' | 'division' | 'childName' | '';
  const [sort1, setSort1] = useState<SortField>('dish');
  const [sort2, setSort2] = useState<SortField>('school');
  const [sort3, setSort3] = useState<SortField>('');

  // Fetch orders when date changes
  useEffect(() => {
    async function fetchOrders() {
      if (!selectedDate) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/kitchen?date=${selectedDate}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setOrders(data.orders || []);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [selectedDate]);

  // Color palette — 12 perceptually distinct hues
  const COLOR_PALETTE = [
    { bg: 'hsl(220,100%,94%)', border: 'hsl(220,80%,62%)' }, // blue
    { bg: 'hsl(10,100%,93%)',  border: 'hsl(10,80%,62%)'  }, // red-orange
    { bg: 'hsl(140,80%,91%)', border: 'hsl(140,60%,42%)'  }, // green
    { bg: 'hsl(55,100%,90%)', border: 'hsl(50,80%,48%)'   }, // yellow
    { bg: 'hsl(280,80%,94%)', border: 'hsl(280,70%,58%)'  }, // purple
    { bg: 'hsl(175,70%,90%)', border: 'hsl(175,60%,40%)'  }, // teal
    { bg: 'hsl(330,80%,94%)', border: 'hsl(330,70%,58%)'  }, // pink
    { bg: 'hsl(30,100%,92%)', border: 'hsl(30,85%,50%)'   }, // orange
    { bg: 'hsl(200,80%,92%)', border: 'hsl(200,70%,46%)'  }, // cyan
    { bg: 'hsl(90,70%,90%)',  border: 'hsl(90,60%,40%)'   }, // lime
    { bg: 'hsl(240,80%,94%)', border: 'hsl(240,70%,62%)'  }, // indigo
    { bg: 'hsl(0,0%,93%)',    border: 'hsl(0,0%,50%)'     }, // gray fallback
  ];

  // Per-school division color map:
  //   key = "schoolName::divisionName" → color from palette
  //   Each school resets its own counter, so divisions within the SAME school
  //   are always distinct; different schools may share palette colors.
  const divisionColors = useMemo(() => {
    // group unique divisions by school, preserving first-seen order
    const schoolDivMap: Record<string, string[]> = {};
    orders.forEach(o => {
      const school = (o.children?.schools as any)?.name || '__unknown__';
      const div = o.children?.division || '';
      if (!div) return;
      if (!schoolDivMap[school]) schoolDivMap[school] = [];
      if (!schoolDivMap[school].includes(div)) schoolDivMap[school].push(div);
    });
    const map: Record<string, { bg: string; border: string }> = {};
    Object.entries(schoolDivMap).forEach(([school, divs]) => {
      divs.forEach((div, i) => {
        map[`${school}::${div}`] = COLOR_PALETTE[i % COLOR_PALETTE.length];
      });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // Pictographic icon set matching the physical sticker sheet.
  // ECS EC is always assigned 'cross'. All other schools get sequential icons.
  // 'cross' is excluded from the sequential list so it stays reserved for ECS EC.
  const ICON_EMOJI: Record<string, string> = {
    cross:     '✚',  // physical sticker: cross (ECS EC)
    wind:      '🌀', // physical sticker: swirl/wind (WESTWIND)
    heart:     '♥',  // physical sticker: heart
    star:      '★',  // physical sticker: starfish/star
    anchor:    '⚓', // physical sticker: anchor
    crown:     '♛',  // physical sticker: crown
    lightning: '⚡', // physical sticker: lightning bolt
    moon:      '☽',  // physical sticker: moon
    leaf:      '🍃', // physical sticker: leaf
    shield:    '🛡', // physical sticker: shield
    flower:    '✿',  // physical sticker: flower
    cloud:     '☁',  // physical sticker: cloud
    snowflake: '❄',  // physical sticker: snowflake
    bell:      '🔔', // physical sticker: bell
    arrow:     '↑',  // physical sticker: arrow
    fish:      '🐟', // physical sticker: fish
    owl:       '🦉', // physical sticker: owl
    elephant:  '🐘', // physical sticker: elephant
    dolphin:   '🐬', // physical sticker: dolphin
    horse:     '🐴', // physical sticker: horse
    swan:      '🦢', // physical sticker: swan
    panda:     '🐼', // physical sticker: panda
    cat:       '🐱', // physical sticker: cat
  };
  // Sequential order for non-ECS-EC schools (cross is reserved)
  const ICON_ORDER = [
    'heart','star','anchor','crown',
    'lightning','moon','leaf','shield','flower','cloud',
    'snowflake','bell','arrow','fish','owl','elephant','dolphin',
    'horse','swan','panda','cat',
  ];
  const schoolIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 0;
    orders.forEach(o => {
      const school = (o.children?.schools as any)?.name || '';
      if (school && !(school in map)) {
        // Named schools get fixed icons so they never collide or change
        if (school === 'ECS EC') {
          map[school] = 'cross';     // cross sticker — reserved for ECS EC only
        } else if (school.toUpperCase().includes('WESTWIND')) {
          map[school] = 'wind';      // swirl sticker — reserved for any Westwind school
        } else {
          map[school] = ICON_ORDER[idx % ICON_ORDER.length];
          idx++;
        }
      }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // Helper to get sort value for a label
  const getLabelSortVal = (label: any, field: SortField): string => {
    if (!field) return '';
    const dish = initialDishes.find(d => d.id === label.dishId);
    if (field === 'dish') return dish?.name || '';
    if (field === 'school') return (label.child?.schools as any)?.name || '';
    if (field === 'division') return label.child?.division || '';
    if (field === 'childName') return label.child?.name || '';
    return '';
  };

  // Flatten orders into individual labels (1 label per item quantity)
  const labelsToPrint = useMemo(() => {
    const list: any[] = [];
    orders.forEach(order => {
      order.order_items.forEach((item: any) => {
        for (let q = 0; q < item.quantity; q++) {
          list.push({
            orderId: order.id,
            child: order.children,
            dishId: item.dish_id,
            itemNumber: q + 1,
            totalQuantity: item.quantity
          });
        }
      });
    });
    // Apply cascading sort
    return list.sort((a, b) => {
      const sorts: SortField[] = [sort1, sort2, sort3].filter(Boolean) as SortField[];
      if (sorts.length === 0) sorts.push('dish');
      for (const sf of sorts) {
        const cmp = getLabelSortVal(a, sf).localeCompare(getLabelSortVal(b, sf));
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, sort1, sort2, sort3, initialDishes]);

  // Aggregate Data
  const { mealTotals, ingredientTotals, totalPrepTime, totalCookTime, totalPackSeconds } = useMemo(() => {
    const mealMap: Record<string, number> = {};
    const ingMap: Record<string, { amount: number; unit: string }> = {};
    let prep = 0, cook = 0, packSeconds = 0;

    orders.forEach(order => {
      order.order_items.forEach((item: any) => {
        mealMap[item.dish_id] = (mealMap[item.dish_id] || 0) + item.quantity;
      });
    });

    Object.entries(mealMap).forEach(([dishId, totalQty]) => {
      const dish = initialDishes.find(d => d.id === dishId);
      if (dish) {
        if (dish.ingredients) {
          dish.ingredients.forEach(ing => {
            const key = `${ing.name}|${ing.unit}`;
            if (!ingMap[key]) ingMap[key] = { amount: 0, unit: ing.unit };
            ingMap[key].amount += (ing.amount * totalQty);
          });
        }
        prep += (dish.prep_time_minutes || 0);
        cook += (dish.cook_time_minutes || 0);
        packSeconds += ((dish.pack_time_seconds || 0) * totalQty);
      }
    });

    return { mealTotals: mealMap, ingredientTotals: ingMap, totalPrepTime: prep, totalCookTime: cook, totalPackSeconds: packSeconds };
  }, [orders, initialDishes]);

  const uniqueCategories = Array.from(new Set(initialDishes.map(d => d.category)));

  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const sortParams = [sort1, sort2, sort3].filter(Boolean).join(',');
      const res = await fetch(`/api/admin/labels-pdf?date=${selectedDate}&sort=${sortParams}&t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${selectedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Avery 5160 Print Styles (only loaded when activeTab is labels) */}
      {activeTab === 'labels' && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: 8.5in 11in;
              margin: 0;
            }

            /* White only - no ink waste */
            html, body, * {
              background: white !important;
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-shadow: none !important;
            }

            /* Hide all UI chrome */
            nav, aside, .print\\:hidden,
            .no-print { display: none !important; }

            /* Wrapper: Avery 5160 exact margins (spec: 0.5" top/bottom, 0.19" sides) */
            .labels-print-wrapper {
              display: block !important;
              width: 8.5in !important;
              padding: 0.5in 0.19in !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              background: white !important;
            }

            /* Grid: 3 cols x 10 rows, 0.125" col gap, 0" row gap */
            .labels-print-grid {
              display: grid !important;
              grid-template-columns: 2.625in 2.625in 2.625in !important;
              column-gap: 0.125in !important;
              row-gap: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Label: exactly 2.625in x 1in, NO border (Avery sheet has its own) */
            .avery-label {
              width: 2.625in !important;
              height: 1in !important;
              min-height: 1in !important;
              max-height: 1in !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              border-radius: 0 !important;
              border: none !important;
              padding: 5pt 5pt 3pt 6pt !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              gap: 1.5pt !important;
              background: white !important;
              color: black !important;
            }

            /* Name + Div on same line */
            .avery-label .label-row1 {
              display: flex !important;
              align-items: baseline !important;
              gap: 4pt !important;
            }
            .avery-label .label-name {
              font-size: 9pt !important;
              font-weight: 900 !important;
              text-transform: uppercase !important;
              line-height: 1 !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              flex: 1 !important;
              color: black !important;
            }
            .avery-label .label-div-badge {
              font-size: 7pt !important;
              font-weight: 900 !important;
              background: white !important;
              border: 0.5pt solid #333 !important;
              padding: 0.5pt 3pt !important;
              border-radius: 1pt !important;
              flex-shrink: 0 !important;
              color: black !important;
            }

            /* Delivery + time */
            .avery-label .label-row2 {
              display: flex !important;
              justify-content: space-between !important;
              font-size: 6pt !important;
              font-weight: 600 !important;
              color: #333 !important;
              line-height: 1 !important;
              text-transform: uppercase !important;
            }

            /* Dashed separator */
            .avery-label .label-divider {
              border: none !important;
              border-top: 0.4pt dashed #777 !important;
              margin: 2pt 0 !important;
            }

            /* Dish name */
            .avery-label .label-dish {
              display: flex !important;
              align-items: center !important;
              gap: 3pt !important;
              font-size: 8.5pt !important;
              font-weight: 800 !important;
              line-height: 1 !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              color: black !important;
            }

            /* Footer: school + date */
            .avery-label .label-footer {
              display: flex !important;
              justify-content: space-between !important;
              font-size: 5.5pt !important;
              font-weight: 500 !important;
              color: #444 !important;
              margin-top: auto !important;
              line-height: 1 !important;
            }
            .avery-label .label-school {
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              max-width: 70% !important;
            }

            /* Hide screen-only decorations */
            .label-color-strip { display: none !important; }
          }
        `}} />
      )}

      
      {/* Controls - Hidden when printing */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col gap-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Date :
            </label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none min-w-[200px]"
            />
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('prep')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'prep' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Prep Sheet
            </button>
            <button 
              onClick={() => setActiveTab('labels')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'labels' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Packing Labels
            </button>
            <button 
              onClick={() => setActiveTab('manifest')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'manifest' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Manifest
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'labels' && (
              <>
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-slate-800 transition-colors h-10"
                >
                  <Printer className="w-4 h-4" /> Print Labels
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-colors h-10 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? 'Generating...' : 'Download PDF'}
                </button>
              </>
            )}
            {activeTab !== 'labels' && (
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-primary/90 transition-colors h-10"
              >
                <Printer className="w-4 h-4" /> Print {activeTab === 'prep' ? 'Prep Sheet' : 'Manifest'}
              </button>
            )}
          </div>
        </div>

        {/* Label Sort Controls – only visible when on labels tab */}
        {activeTab === 'labels' && (
          <div className="border-t pt-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Sort Labels Before Printing</p>
            <div className="flex flex-wrap gap-4 items-end">
              {([['1st Sort', sort1, setSort1], ['2nd Sort', sort2, setSort2], ['3rd Sort', sort3, setSort3]] as [string, SortField, (v: SortField) => void][]).map(([label, val, setter]) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
                  <select
                    value={val}
                    onChange={e => setter(e.target.value as SortField)}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none min-w-[140px]"
                  >
                    <option value="">— None —</option>
                    <option value="dish">Item / Dish Name</option>
                    <option value="school">School Name</option>
                    <option value="division">Division / Class</option>
                    <option value="childName">Student Name</option>
                  </select>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pb-1">{labelsToPrint.length} labels total</p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-destructive bg-destructive/10 p-4 rounded-xl font-medium">{error}</div>}

      {/* Print Headers */}
      {activeTab !== 'labels' && (
        <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black uppercase tracking-tight">
            {activeTab === 'prep' ? 'Kitchen Prep Sheet' : 'Delivery Manifest'}
          </h1>
          <div className="flex justify-between items-center mt-1">
            <p className="text-lg font-bold text-gray-700">{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
            <p className="text-sm font-bold">Total Orders: {orders.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center p-12 text-muted-foreground animate-pulse">Calculating production data...</div>
      ) : orders.length === 0 ? (
        <div className="bg-muted/30 border-2 border-dashed rounded-2xl p-12 text-center text-muted-foreground print:hidden">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-lg">No paid orders found for this date.</p>
          <p className="text-sm">Select another date to view prep requirements.</p>
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* TAB 1: PREP SHEET */}
          {activeTab === 'prep' && (
            <div className="space-y-8">
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm print:shadow-none print:border-black">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary print:text-black" />
                  <h2 className="text-xl font-bold">Production Estimate</h2>
                </div>
                <div className="grid grid-cols-3 gap-6 divide-x divide-primary/20">
                  <div className="text-center">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Prep</p>
                    <p className="text-2xl font-black">{totalPrepTime} <span className="text-sm opacity-60">min</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Cook</p>
                    <p className="text-2xl font-black">{totalCookTime} <span className="text-sm opacity-60">min</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Pack</p>
                    <p className="text-2xl font-black">{Math.ceil(totalPackSeconds / 60)} <span className="text-sm opacity-60">min</span></p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <ChefHat className="w-6 h-6 text-primary print:text-black" />
                    <h2 className="text-2xl font-bold">1. Assembly Counts</h2>
                  </div>
                  <div className="space-y-4">
                    {uniqueCategories.map(category => {
                      const categoryDishes = initialDishes.filter(d => d.category === category && mealTotals[d.id] > 0);
                      if (categoryDishes.length === 0) return null;
                      return (
                        <div key={category} className="bg-card border rounded-xl overflow-hidden shadow-sm print:border-gray-400">
                          <div className="bg-muted/40 px-4 py-2 border-b font-bold uppercase tracking-wider text-xs">{category}</div>
                          <ul className="divide-y">
                            {categoryDishes.map(dish => (
                              <li key={dish.id} className="p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-lg">{dish.name}</span>
                                  <span className="text-2xl font-black bg-primary/10 text-primary px-4 py-1 rounded-lg print:bg-transparent print:text-black print:border-2 print:border-black">{mealTotals[dish.id]}</span>
                                </div>
                                {dish.ingredients && dish.ingredients.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {dish.ingredients.map(ing => (
                                      <div key={ing.name} className="text-xs bg-muted border rounded-md px-2 py-1 font-medium">
                                        <span className="text-primary font-bold mr-1">{ing.amount * mealTotals[dish.id]}</span> {ing.unit} {ing.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-2xl">⚖️</span>
                    <h2 className="text-2xl font-bold">2. Scaled Ingredients</h2>
                  </div>
                  <div className="bg-card border rounded-xl overflow-hidden shadow-sm print:border-gray-400">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 border-b">
                        <tr>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Ingredient</th>
                          <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Object.entries(ingredientTotals).map(([key, data]) => (
                          <tr key={key} className="hover:bg-muted/10">
                            <td className="px-4 py-3 font-medium">{key.split('|')[0]}</td>
                            <td className="px-4 py-3 text-right font-black text-lg">{data.amount} <span className="text-xs font-bold opacity-60">{data.unit}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PACKING LABELS */}
          {activeTab === 'labels' && (
            <div className="labels-print-wrapper">
              <div className="labels-print-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {labelsToPrint.map((labelInfo, index) => {
                  const schoolName = (labelInfo.child?.schools as any)?.name || '';
                  const divKey = `${schoolName}::${labelInfo.child?.division || ''}`;
                  const color = divisionColors[divKey] || { bg: '#f9f9f9', border: '#aaa' };
                  const dish = initialDishes.find(d => d.id === labelInfo.dishId);
                  const printDate = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                  // Sequential unique icon per school (guaranteed no collisions)
                  // ECS EC is always 'cross'; all other schools get sequential pictographic icons
                  const schoolIconName = schoolIconMap[schoolName] || 'heart';
                  const schoolIconChar = ICON_EMOJI[schoolIconName] || '♥';

                  const formatTimeWithAmPm = (timeStr?: string) => {
                    if (!timeStr) return '';
                    const lower = timeStr.trim().toLowerCase();
                    if (lower.includes('am') || lower.includes('pm')) return lower;
                    const parts = lower.split(':');
                    if (parts.length >= 2) {
                      let h = parseInt(parts[0], 10);
                      const m = parts[1].substring(0, 2);
                      if (!isNaN(h)) {
                        const ampm = h >= 12 ? 'pm' : 'am';
                        h = h % 12;
                        if (h === 0) h = 12;
                        return `${h}:${m}${ampm}`;
                      }
                    }
                    return lower;
                  };
                  const lunchTime = formatTimeWithAmPm(labelInfo.child?.lunch_time);

                  return (
                    <div
                      key={`${labelInfo.orderId}-${labelInfo.dishId}-${index}`}
                      className="avery-label border-2 rounded-2xl p-3 bg-white shadow-sm flex flex-col gap-1 relative overflow-hidden"
                      style={{ borderColor: color.border }}
                    >
                      {/* Color strip on left edge */}
                      <div className="label-color-strip absolute top-0 left-0 bottom-0 w-1.5" style={{ backgroundColor: color.border }} />

                      {/* ROW 1: Name + Div badge */}
                      <div className="label-row1 flex items-center gap-1.5 pl-3">
                        <span className="label-name font-black text-sm uppercase truncate flex-1 leading-none">{labelInfo.child?.name}</span>
                        <span
                          className="label-div-badge text-[10px] font-black px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0"
                          style={{ backgroundColor: color.bg, borderColor: color.border }}
                        >
                          {labelInfo.child?.division || 'N/A'}
                        </span>
                      </div>

                      {/* ROW 2: Dish Name + Time */}
                      <div className="label-row2 flex items-center justify-between font-bold text-[11px] overflow-hidden pl-3 mt-0.5">
                        <span className="truncate flex-1">
                          {dish?.name} {labelInfo.totalQuantity > 1 && <span className="text-[9px] text-muted-foreground ml-1">({labelInfo.itemNumber}/{labelInfo.totalQuantity})</span>}
                        </span>
                        <span className="font-black shrink-0 ml-1 leading-none">{lunchTime}</span>
                      </div>

                      {/* DIVIDER */}
                      <div className="label-divider border-t border-dashed my-1" style={{ borderColor: color.border }} />

                      {/* ROW 3: Icon + School Name + Delivery Location + Date */}
                      <div className="label-footer flex items-center gap-1 text-black font-bold mt-auto pl-3">
                        <span
                          className="shrink-0"
                          style={{ fontSize: '11px', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          title={schoolIconName}
                        >
                          {schoolIconChar}
                        </span>
                        <span className="label-school truncate flex-1" style={{ fontSize: '8px', lineHeight: 1 }}>
                          {schoolName.toUpperCase()} {labelInfo.child?.delivery_location ? `- ${labelInfo.child.delivery_location.toUpperCase()}` : ''}
                        </span>
                        <span className="shrink-0 text-slate-400 font-normal" style={{ fontSize: '7px', lineHeight: 1 }}>{printDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* TAB 3: MANIFEST */}
          {activeTab === 'manifest' && (
            <div className="space-y-12">
              {(() => {
                // Group orders by school
                const ordersBySchool: Record<string, any[]> = {};
                orders.forEach(o => {
                  const schoolName = (o.children?.schools as any)?.name || 'Unknown School';
                  if (!ordersBySchool[schoolName]) ordersBySchool[schoolName] = [];
                  ordersBySchool[schoolName].push(o);
                });

                return Object.entries(ordersBySchool).sort().map(([schoolName, schoolOrders]) => {
                  // For each school, group by division
                  const uniqueDivs = Array.from(new Set(schoolOrders.map(o => o.children?.division).filter(Boolean)));
                  
                  // Calculate total items (sum of quantities) for the school manifest header
                  const totalItemsForSchool = schoolOrders.reduce((sum, o) => {
                    return sum + o.order_items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
                  }, 0);

                  return (
                    <div key={schoolName} className="space-y-6 print:break-after-page last:print:break-after-auto">
                      {/* School Header */}
                      <div className="border-b-4 border-black pb-4 mb-6 print:mb-4">
                        <div className="flex items-center gap-3">
                          <h2 className="text-3xl font-black uppercase">{schoolName}</h2>
                          {(() => {
                            const firstOrder = schoolOrders[0];
                            const stopOrder = (firstOrder?.children?.schools as any)?.school_routes?.[0]?.stop_order || 0;
                            const routeNumber = (firstOrder?.children?.schools as any)?.school_routes?.[0]?.routes?.route_number || '';
                            let routeText = '';
                            if (routeNumber) routeText += `Rt ${routeNumber}`;
                            if (stopOrder > 0) routeText += (routeText ? ` - Stop ${stopOrder}` : `Stop ${stopOrder}`);
                            
                            return routeText ? (
                              <span className="text-xl font-bold text-muted-foreground uppercase pt-1">
                                {routeText}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex justify-between items-end mt-2">
                           <div>
                             <p className="text-lg font-bold text-gray-700">{format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                             <p className="text-sm font-medium text-muted-foreground mt-1 print:hidden">[ School Address - Add in Settings ]</p>
                           </div>
                           <div className="text-right">
                             <p className="font-bold text-xl print:text-lg">{totalItemsForSchool} Total Items</p>
                           </div>
                        </div>
                      </div>
                      
                      {/* Divisions within this school */}
                      <div className="space-y-6 print:space-y-4">
                        {uniqueDivs.sort().map(div => {
                           const divOrders = schoolOrders.filter(o => o.children?.division === div);
                           const color = divisionColors[div as string] || { bg: '#f9f9f9', border: '#ccc' };
                           
                           // Aggregate items
                           const divTotals: Record<string, number> = {};
                           divOrders.forEach(o => {
                             o.order_items.forEach((item: any) => {
                               divTotals[item.dish_id] = (divTotals[item.dish_id] || 0) + item.quantity;
                             });
                           });

                           return (
                             <div key={div as string} className="border-2 rounded-2xl overflow-hidden shadow-sm print:border print:rounded-xl print:shadow-none print:break-inside-avoid">
                               <div 
                                 className="px-6 py-3 flex justify-between items-center border-b-2 print:border-b print:px-3 print:py-1"
                                 style={{ backgroundColor: color.bg, borderColor: color.border }}
                               >
                                 <h3 className="text-xl font-black print:text-xs print:font-bold">{div as string}</h3>
                                 <div className="flex gap-4 text-sm font-bold print:text-[9px] print:gap-2">
                                   <span>{divOrders.length} Students</span>
                                   <span>{Object.values(divTotals).reduce((a, b) => a + b, 0)} Items</span>
                                 </div>
                               </div>
                               <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 print:p-3 print:grid-cols-2 print:gap-4">
                                 <table className="w-full text-left border-collapse print:text-[10px]">
                                   <thead>
                                     <tr className="text-[10px] font-black uppercase text-muted-foreground border-b print:border-black print:text-[8px]">
                                       <th className="pb-2 print:pb-1">Dish</th>
                                       <th className="pb-2 text-right w-20 print:pb-1">Qty</th>
                                     </tr>
                                   </thead>
                                   <tbody className="divide-y print:divide-slate-200">
                                     {Object.entries(divTotals).map(([dishId, qty]) => (
                                       <tr key={dishId}>
                                         <td className="py-2 print:py-1 font-semibold">{initialDishes.find(d => d.id === dishId)?.name}</td>
                                         <td className="py-2 text-right font-black text-lg print:text-xs print:py-1">{qty}</td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>

                                 <div className="bg-muted/20 rounded-xl p-4 space-y-2 border border-dashed print:bg-transparent print:p-0 print:border-none print:space-y-1">
                                    <h4 className="text-[10px] font-black uppercase text-muted-foreground print:text-[8px] print:font-bold print:text-black">
                                      Packing & Verification Checklist
                                    </h4>
                                    
                                    {/* Screen list of names */}
                                    <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 print:hidden">
                                       {divOrders.map(o => (
                                         <div key={o.id} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                            <span className="capitalize">{o.children?.name}</span>
                                          </div>
                                       ))}
                                    </div>

                                    {/* Print checklist (individual items with checkboxes) */}
                                    <div className="hidden print:flex flex-col gap-0.5 text-[8.5px] leading-tight text-slate-700">
                                       {(() => {
                                         let itemIdx = 0;
                                         return divOrders.flatMap(o => 
                                           o.order_items.flatMap((item: any) => {
                                             const dish = initialDishes.find(d => d.id === item.dish_id);
                                             const itemsList = [];
                                             for (let i = 0; i < item.quantity; i++) {
                                               itemIdx++;
                                               itemsList.push(
                                                 <div key={`${o.id}-${item.dish_id}-${i}`} className="flex items-center gap-1 border-b border-dotted border-slate-200 pb-0.5">
                                                   <span className="inline-block w-3.5 text-center font-bold text-slate-400">{itemIdx}</span>
                                                   <span className="inline-block w-3 h-3 border border-slate-400 rounded-sm flex-shrink-0 mr-1" />
                                                   <span className="capitalize font-bold truncate max-w-[85px]">{o.children?.name}</span>
                                                   <span className="text-slate-500 truncate flex-1">— {dish?.name}</span>
                                                 </div>
                                               );
                                             }
                                             return itemsList;
                                           })
                                         );
                                       })()}
                                    </div>
                                 </div>
                               </div>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
