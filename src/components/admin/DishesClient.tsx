'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, ArrowUp, ArrowDown, ChefHat, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  cost_per_unit?: number;
  large_amount?: number;
}

interface Overhead {
  name: string;
  amount: number;
}

interface Dish {
  id: string;
  name: string;
  category: string;
  price_regular: number;
  price_vip: number;
  sort_order: number;
  is_active: boolean;
  recipe_url?: string;
  ingredients?: Ingredient[];
  instructions?: string | null;
  overhead_costs?: Overhead[];
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  pack_time_seconds?: number;
  has_large?: boolean;
  large_name?: string;
  large_price_regular?: number;
  large_price_vip?: number;
}

const DEFAULT_CATEGORIES = ['main', 'side', 'snack', 'drink'];
const DEFAULT_UNITS = ['g', 'kg', 'ml', 'L', 'cups', 'tbsp', 'tsp', 'pcs', 'oz', 'lbs', 'slices', 'cans', 'bags', 'chunk', 'pinch'];

const emptyForm = { 
  name: '', 
  category: 'main', 
  price_regular: '', 
  price_vip: '', 
  sort_order: 0, 
  is_active: true, 
  recipe_url: '', 
  ingredients: [{ name: '', amount: 1, unit: 'pcs', cost_per_unit: 0 }] as Ingredient[],
  instructions: '',
  overhead_costs: [] as Overhead[],
  prep_time_minutes: 0,
  cook_time_minutes: 0,
  pack_time_seconds: 0,
  has_large: false,
  large_name: '',
  large_price_regular: '',
  large_price_vip: ''
};

export default function DishesClient({ initialDishes, orgSettings }: { initialDishes: Dish[], orgSettings?: any }) {
  const [dishes, setDishes] = useState<Dish[]>(initialDishes);

  const SETTINGS_CATEGORIES = orgSettings?.categories || DEFAULT_CATEGORIES;
  const SETTINGS_UNITS = orgSettings?.units || DEFAULT_UNITS;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Dynamic lists
  const uniqueCategories = useMemo(() => Array.from(new Set([...SETTINGS_CATEGORIES, ...dishes.map(d => d.category)])), [dishes, SETTINGS_CATEGORIES]);
  const uniqueUnits = useMemo(() => Array.from(new Set([...SETTINGS_UNITS, ...dishes.flatMap(d => d.ingredients?.map(i => i.unit) || [])])), [dishes, SETTINGS_UNITS]);

  // Derived Financials for the Form
  const totalIngredientCost = form.ingredients.reduce((acc, ing) => acc + (Number(ing.amount) || 0) * (Number(ing.cost_per_unit) || 0), 0);
  const totalOverheadCost = form.overhead_costs.reduce((acc, ov) => acc + (Number(ov.amount) || 0), 0);
  const totalCost = totalIngredientCost + totalOverheadCost;
  const estProfitReg = (Number(form.price_regular) || 0) - totalCost;
  const estProfitVip = (Number(form.price_vip) || 0) - totalCost;

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  
  const openEdit = (d: Dish) => { 
    setEditing(d); 
    setForm({ 
      name: d.name, 
      category: d.category || 'main', 
      price_regular: String(d.price_regular), 
      price_vip: String(d.price_vip), 
      sort_order: d.sort_order || 0, 
      is_active: d.is_active, 
      recipe_url: d.recipe_url || '', 
      ingredients: d.ingredients && d.ingredients.length > 0 ? d.ingredients : [{ name: '', amount: 1, unit: 'pcs', cost_per_unit: 0 }],
      instructions: d.instructions || '',
      overhead_costs: d.overhead_costs || [],
      prep_time_minutes: d.prep_time_minutes || 0,
      cook_time_minutes: d.cook_time_minutes || 0,
      pack_time_seconds: d.pack_time_seconds || 0,
      has_large: d.has_large || false,
      large_name: d.large_name || '',
      large_price_regular: d.large_price_regular ? String(d.large_price_regular) : '',
      large_price_vip: d.large_price_vip ? String(d.large_price_vip) : ''
    }); 
    setShowForm(true); 
  };
  
  const closeForm = () => { 
    setShowForm(false); 
    setEditing(null); 
  };

  // Handlers for dynamic arrays
  const addIngredientRow = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: 1, unit: 'pcs', cost_per_unit: 0 }] }));
  const removeIngredientRow = (idx: number) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  const updateIngredient = (idx: number, field: keyof Ingredient, value: any) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing) }));
  };

  const addOverheadRow = () => setForm(f => ({ ...f, overhead_costs: [...f.overhead_costs, { name: '', amount: 0 }] }));
  const removeOverheadRow = (idx: number) => setForm(f => ({ ...f, overhead_costs: f.overhead_costs.filter((_, i) => i !== idx) }));
  const updateOverhead = (idx: number, field: keyof Overhead, value: any) => {
    setForm(f => ({ ...f, overhead_costs: f.overhead_costs.map((ov, i) => i === idx ? { ...ov, [field]: value } : ov) }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price_regular || !form.price_vip) { 
      toast.error('Please fill in Name, Category, and Prices.'); return; 
    }
    
    if (form.has_large) {
      if (!form.large_name.trim() || !form.large_price_regular || !form.large_price_vip) {
        toast.error('Please fill in Large Name and Large Prices.'); return;
      }
    }
    
    // Clean arrays
    const cleanIngredients = form.ingredients.filter(i => i.name.trim() !== '').map(i => ({...i, amount: Number(i.amount) || 0, cost_per_unit: Number(i.cost_per_unit) || 0}));
    const cleanOverheads = form.overhead_costs.filter(o => o.name.trim() !== '').map(o => ({...o, amount: Number(o.amount) || 0}));

    setSaving(true);
    try {
      const payload = { 
        name: form.name.trim(), 
        category: form.category.toLowerCase().trim(), 
        price_regular: parseFloat(form.price_regular as string), 
        price_vip: parseFloat(form.price_vip as string), 
        sort_order: form.sort_order,
        is_active: form.is_active,
        recipe_url: form.recipe_url.trim() || null,
        ingredients: cleanIngredients,
        instructions: form.instructions.trim() || null,
        overhead_costs: cleanOverheads,
        prep_time_minutes: Number(form.prep_time_minutes) || 0,
        cook_time_minutes: Number(form.cook_time_minutes) || 0,
        pack_time_seconds: Number(form.pack_time_seconds) || 0,
        has_large: form.has_large,
        large_name: form.has_large ? form.large_name.trim() : null,
        large_price_regular: form.has_large && form.large_price_regular ? parseFloat(form.large_price_regular as string) : null,
        large_price_vip: form.has_large && form.large_price_vip ? parseFloat(form.large_price_vip as string) : null,
      };
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/admin/dishes/${editing.id}` : '/api/admin/dishes';
      
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }

      if (editing) {
        setDishes(prev => prev.map(d => d.id === editing.id ? data.dish : d));
        toast.success('Dish updated');
      } else {
        setDishes(prev => [...prev, data.dish]);
        toast.success('Dish created');
      }
      closeForm();
    } catch (e) { toast.error('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (dish: Dish) => {
    const res = await fetch(`/api/admin/dishes/${dish.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dish, is_active: !dish.is_active }) });
    const data = await res.json();
    if (!data.error) setDishes(prev => prev.map(d => d.id === dish.id ? data.dish : d));
  };

  const handleDelete = async (dish: Dish) => {
    if (!confirm(`Delete "${dish.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/dishes/${dish.id}`, { method: 'DELETE' });
    if (res.ok) setDishes(prev => prev.filter(d => d.id !== dish.id));
  };

  const handleMove = async (dish: Dish, direction: 'up' | 'down') => {
    let categoryDishes = dishes.filter(d => d.category === dish.category).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    categoryDishes = categoryDishes.map((d, i) => ({ ...d, sort_order: i }));

    const currentIndex = categoryDishes.findIndex(d => d.id === dish.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === categoryDishes.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const adjacentDish = categoryDishes[swapIndex];

    const newCurrentOrder = adjacentDish.sort_order;
    const newAdjacentOrder = categoryDishes[currentIndex].sort_order;

    setDishes(prev => prev.map(d => {
      if (d.id === dish.id) return { ...d, sort_order: newCurrentOrder };
      if (d.id === adjacentDish.id) return { ...d, sort_order: newAdjacentOrder };
      const catDish = categoryDishes.find(cd => cd.id === d.id);
      if (catDish) return { ...d, sort_order: catDish.sort_order };
      return d;
    }));

    await Promise.all(categoryDishes.map(d => {
      let finalOrder = d.sort_order;
      if (d.id === dish.id) finalOrder = newCurrentOrder;
      if (d.id === adjacentDish.id) finalOrder = newAdjacentOrder;
      return fetch(`/api/admin/dishes/${d.id}`, { 
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, sort_order: finalOrder }) 
      });
    }));
  };

  return (
    <div className="space-y-6">


      {showForm ? (
        <div className="bg-card border rounded-2xl shadow-sm w-full animate-fade-in-up">
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-2xl">
            <div>
              <h2 className="text-xl font-extrabold">{editing ? 'Edit Dish & Recipe' : 'New Dish & Recipe'}</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage everything from menu visibility to kitchen instructions and profitability.</p>
            </div>
            <button onClick={closeForm} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN: Info & Costs */}
            <div className="space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2">Basic Info</h3>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Dish Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Signature Mac & Cheese" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl bg-muted/20">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Active (visible on parent menu)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl bg-muted/20">
                  <input type="checkbox" checked={form.has_large} onChange={e => setForm(f => ({...f, has_large: e.target.checked}))} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Has Large Option?</span>
                </label>

                {form.has_large && (
                  <div className="p-4 border rounded-xl bg-primary/5 space-y-4 animate-fade-in-up">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Large Option Name</label>
                      <input value={form.large_name} onChange={e => setForm(f => ({...f, large_name: e.target.value}))}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                        placeholder="e.g. Signature Mac & Cheese (Large)" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Large Regular Price ($)</label>
                        <input type="number" step="0.01" min="0" value={form.large_price_regular} onChange={e => setForm(f => ({...f, large_price_regular: e.target.value}))}
                          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-primary">Large VIP Price ($)</label>
                        <input type="number" step="0.01" min="0" value={form.large_price_vip} onChange={e => setForm(f => ({...f, large_price_vip: e.target.value}))}
                          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none font-bold text-primary" />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Prices & Overheads</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Regular Price ($)</label>
                    <input type="number" step="0.01" min="0" value={form.price_regular} onChange={e => setForm(f => ({...f, price_regular: e.target.value}))}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-primary">VIP Price ($)</label>
                    <input type="number" step="0.01" min="0" value={form.price_vip} onChange={e => setForm(f => ({...f, price_vip: e.target.value}))}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none font-bold text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">Additional Overhead Costs (Per Dish)</label>
                  </div>
                  {form.overhead_costs.map((ov, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={ov.name} onChange={e => updateOverhead(idx, 'name', e.target.value)} className="flex-1 h-9 rounded border px-2 text-sm outline-none" placeholder="e.g. Labor, Takeout Box" />
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input type="number" step="0.01" min="0" value={ov.amount} onChange={e => updateOverhead(idx, 'amount', e.target.value)} className="w-full h-9 rounded border pl-6 pr-2 text-sm outline-none" />
                      </div>
                      <button onClick={() => removeOverheadRow(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={addOverheadRow} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> Add Overhead Cost</button>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4 space-y-2">
                  <h4 className="text-xs font-bold text-primary uppercase">Estimated Profit Dashboard</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Food Cost:</span> <span className="font-medium">${totalIngredientCost.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Overhead:</span> <span className="font-medium">${totalOverheadCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-primary/20 grid grid-cols-2 gap-4 text-sm font-bold">
                    <div className="text-green-700">Reg Profit: ${(estProfitReg).toFixed(2)}</div>
                    <div className="text-emerald-700">VIP Profit: ${(estProfitVip).toFixed(2)}</div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Production Time</h3>
                <p className="text-xs text-muted-foreground mb-2">Used by the Kitchen Prep engine to estimate required labor time.</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Prep (min/batch)</label>
                    <input type="number" min="0" value={form.prep_time_minutes} onChange={e => setForm(f => ({...f, prep_time_minutes: Number(e.target.value)}))} className="w-full h-9 rounded border px-2 text-sm outline-none text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Cook (min/batch)</label>
                    <input type="number" min="0" value={form.cook_time_minutes} onChange={e => setForm(f => ({...f, cook_time_minutes: Number(e.target.value)}))} className="w-full h-9 rounded border px-2 text-sm outline-none text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pack (sec/box)</label>
                    <input type="number" min="0" value={form.pack_time_seconds} onChange={e => setForm(f => ({...f, pack_time_seconds: Number(e.target.value)}))} className="w-full h-9 rounded border px-2 text-sm outline-none text-center" />
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Recipe & Ingredients */}
            <div className="space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 flex items-center gap-2"><ChefHat className="w-4 h-4"/> Ingredients & Scaling</h3>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  <div className="flex gap-2 text-xs font-bold text-muted-foreground px-1">
                    <div className="flex-1">Ingredient</div>
                    <div className="w-16 text-center">Amt</div>
                    {form.has_large && <div className="w-16 text-center text-primary">Lrg Amt</div>}
                    <div className="w-20">Unit</div>
                    <div className="w-20">Cost/Unit</div>
                    <div className="w-8"></div>
                  </div>
                  {form.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" placeholder="e.g. Chicken" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)} className="flex-1 rounded border p-2 text-sm outline-none" />
                      <input type="number" step="0.01" min="0" value={ing.amount} onChange={e => updateIngredient(idx, 'amount', e.target.value)} className="w-16 rounded border p-2 text-sm text-center outline-none" />
                      {form.has_large && (
                        <input type="number" step="0.01" min="0" placeholder="-" value={ing.large_amount || ''} onChange={e => updateIngredient(idx, 'large_amount', e.target.value)} className="w-16 rounded border border-primary/30 bg-primary/5 p-2 text-sm text-center outline-none text-primary" title="Amount for Large option" />
                      )}
                      <select 
                        value={ing.unit || 'pcs'} 
                        onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-20 rounded border px-1 py-2 text-sm outline-none bg-background"
                      >
                        {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div className="relative w-20">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={ing.cost_per_unit || ''} onChange={e => updateIngredient(idx, 'cost_per_unit', e.target.value)} className="w-full rounded border py-2 pl-4 pr-1 text-sm outline-none" title="Cost per single unit" />
                      </div>
                      <button onClick={() => removeIngredientRow(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addIngredientRow} className="text-sm text-primary font-bold flex items-center gap-1 hover:underline"><Plus className="w-4 h-4" /> Add Ingredient</button>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2">Cooking Instructions</h3>
                <textarea
                  placeholder="Step 1: Prep the ingredients...&#10;Step 2: Cook at 350°F..."
                  value={form.instructions}
                  onChange={e => setForm(f => ({...f, instructions: e.target.value}))}
                  rows={8}
                  className="w-full rounded-lg border bg-background p-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-y"
                />
              </section>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3 bg-muted/10 rounded-b-2xl">
            <button onClick={closeForm} className="px-6 py-2.5 rounded-xl font-bold border bg-card hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground px-8 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? 'Saving...' : <><Check className="w-5 h-5"/> Save Everything</>}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Add Button */}
          <div className="flex justify-end">
            <button onClick={openAdd} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add New Dish
            </button>
          </div>

          {/* Dishes by Category */}
          {uniqueCategories.map(category => {
            const categoryDishes = dishes.filter(d => d.category === category).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            if (categoryDishes.length === 0) return null;

            return (
              <div key={category} className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary`}>{category}</span>
                  <span className="text-muted-foreground text-sm">({categoryDishes.length} items)</span>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-left text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-3 font-semibold w-16">Order</th>
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Regular Price</th>
                      <th className="px-6 py-3 font-semibold">VIP Price</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {categoryDishes.map((dish, i) => (
                      <tr key={dish.id} className={`hover:bg-muted/30 transition-colors ${!dish.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 w-6">
                            <button disabled={i === 0} onClick={() => handleMove(dish, 'up')} className="p-1 rounded bg-secondary hover:bg-primary/20 disabled:opacity-30 transition-colors">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button disabled={i === categoryDishes.length - 1} onClick={() => handleMove(dish, 'down')} className="p-1 rounded bg-secondary hover:bg-primary/20 disabled:opacity-30 transition-colors">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                          <span>{dish.name}</span>
                          {dish.has_large && (
                            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">
                              Lg Available
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">${Number(dish.price_regular).toFixed(2)}</td>
                        <td className="px-6 py-4 text-primary font-semibold">${Number(dish.price_vip).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${dish.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {dish.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(dish)} className="p-1.5 rounded-lg border hover:bg-muted" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToggle(dish)} className="p-1.5 rounded-lg border hover:bg-muted" title={dish.is_active ? 'Deactivate' : 'Activate'}>
                              {dish.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            <button onClick={() => handleDelete(dish)} className="p-1.5 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
