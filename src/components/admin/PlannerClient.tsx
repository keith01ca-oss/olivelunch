'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfWeek, addDays, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, GripVertical, Trash2, Loader2, Info, Settings, CalendarPlus, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PlannerClient({ initialDishes, blockedDates, org }: { initialDishes: any[], blockedDates: any[], org?: any }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [scheduledMenus, setScheduledMenus] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New State Features
  const [showWeekends, setShowWeekends] = useState(org?.settings?.show_weekends || false);
  const [selectedDishes, setSelectedDishes] = useState<any[]>([]);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const handleToggleWeekends = async (checked: boolean) => {
    setShowWeekends(checked);
    if (!org) return;
    try {
      const newSettings = { ...(org.settings || {}), show_weekends: checked };
      await fetch(`/api/admin/orgs/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
    } catch (e) {
      console.error('Failed to save settings');
    }
  };

  // Group dishes by category
  const categories = useMemo(() => {
    const unique = Array.from(new Set(initialDishes.map(d => d.category)));
    return unique.sort();
  }, [initialDishes]);

  // Fetch menus for the current month
  useEffect(() => {
    async function fetchMenus() {
      setIsLoading(true);
      try {
        const monthKey = format(currentMonth, 'yyyy-MM');
        const res = await fetch(`/api/admin/menus?month=${monthKey}`);
        const data = await res.json();
        if (data.menus) {
          setScheduledMenus(data.menus);
        }
      } catch (err) {
        toast.error('Failed to load scheduled menus');
      } finally {
        setIsLoading(false);
      }
    }
    fetchMenus();
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    
    const days: Date[] = [];
    let current = startDate;
    const end = addDays(startDate, 42); // 6 weeks worth of days

    while (current < end) {
      const dayOfWeek = getDay(current);
      if (showWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        days.push(current);
      }
      current = addDays(current, 1);
    }
    return days;
  }, [currentMonth, showWeekends]);

  // DRAG AND DROP HANDLERS
  const handleDragStart = (e: React.DragEvent, dishId: string) => {
    let idsToDrag = [dishId];
    if (selectedDishes.some(d => d.id === dishId)) {
      idsToDrag = selectedDishes.map(d => d.id);
    }
    e.dataTransfer.setData('dish_ids', JSON.stringify(idsToDrag));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Ignore drops on weekends (if hidden) or blocked dates
    const dayOfWeek = getDay(date);
    if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) return;
    if (blockedDates.some(b => b.date === dateKey)) return;

    const dishIdsStr = e.dataTransfer.getData('dish_ids');
    if (!dishIdsStr) return;
    
    let dishIds: string[] = [];
    try {
      dishIds = JSON.parse(dishIdsStr);
    } catch (err) {
      dishIds = [e.dataTransfer.getData('dish_id')]; // Fallback for old drags
    }
    
    if (dishIds.length === 0 || !dishIds[0]) return;

    // Filter out duplicates
    const validIds = dishIds.filter(id => !scheduledMenus.some(m => m.date === dateKey && m.dish_id === id));
    
    if (validIds.length === 0) {
      toast.error('Dishes already scheduled for this date');
      return;
    }

    setIsSaving(true);
    try {
      const inserts = validIds.map(id => ({ date: dateKey, dish_id: id }));
      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: inserts }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setScheduledMenus(prev => [...prev, ...data.menus]);
      toast.success(`Scheduled ${validIds.length} item(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule menus');
    } finally {
      setIsSaving(false);
    }
  };

  const removeMenu = async (id: string) => {
    if (!confirm('Remove this dish from the schedule?')) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/menus/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setScheduledMenus(prev => prev.filter(m => m.id !== id));
      toast.success('Menu removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove menu');
    } finally {
      setIsSaving(false);
    }
  };

  const availableDays = useMemo(() => {
    const days = [
      { label: 'M', value: 1, full: 'Mon' },
      { label: 'T', value: 2, full: 'Tue' },
      { label: 'W', value: 3, full: 'Wed' },
      { label: 'T', value: 4, full: 'Thu' },
      { label: 'F', value: 5, full: 'Fri' },
    ];
    if (showWeekends) {
      days.push({ label: 'S', value: 6, full: 'Sat' });
      days.push({ label: 'S', value: 0, full: 'Sun' });
    }
    return days;
  }, [showWeekends]);

  // Helper to compute valid target dates in current month based on day-of-week filter
  const getValidTargetDates = (daysFilter: number[] = selectedDaysOfWeek) => {
    return calendarDays.filter(date => {
      const isCurrentMonth = isSameMonth(date, currentMonth);
      if (!isCurrentMonth) return false;

      const dateKey = format(date, 'yyyy-MM-dd');
      const isBlocked = blockedDates.some(b => b.date === dateKey);
      if (isBlocked) return false;

      const dayOfWeek = getDay(date);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!showWeekends && isWeekend) return false;

      if (!daysFilter.includes(dayOfWeek)) return false;

      return true;
    });
  };

  const handleAddDishesToAllMonth = async () => {
    if (selectedDishes.length === 0) return;
    
    const validDates = getValidTargetDates(selectedDaysOfWeek);

    if (validDates.length === 0) {
      toast.info('No valid dates available for the selected days.');
      return;
    }

    const selectedDayLabels = availableDays
      .filter(d => selectedDaysOfWeek.includes(d.value))
      .map(d => d.full)
      .join(', ');

    const promptMsg = `Add ${selectedDishes.length} dish(es) to ${selectedDayLabels} (${validDates.length} days) in ${format(currentMonth, 'MMMM')}?`;
    if (!confirm(promptMsg)) return;

    setIsSaving(true);
    try {
      const inserts: any[] = [];
      validDates.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        selectedDishes.forEach(dish => {
          if (!scheduledMenus.some(m => m.date === dateKey && m.dish_id === dish.id)) {
            inserts.push({ date: dateKey, dish_id: dish.id });
          }
        });
      });

      if (inserts.length === 0) {
        toast.info('Dishes are already scheduled on all these dates.');
        setIsSaving(false);
        return;
      }

      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: inserts }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setScheduledMenus(prev => [...prev, ...(data.menus || [])]);
      toast.success(`Successfully scheduled ${inserts.length} item(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to schedule bulk items');
    } finally {
      setIsSaving(false);
      setSelectedDishes([]);
    }
  };

  const handleAddAllActiveDishesToMonth = async () => {
    const dishesToAdd = initialDishes;
    if (dishesToAdd.length === 0) return;
    
    const validDates = getValidTargetDates(selectedDaysOfWeek);

    if (validDates.length === 0) {
      toast.info('No valid dates available for the selected days.');
      return;
    }

    const selectedDayLabels = availableDays
      .filter(d => selectedDaysOfWeek.includes(d.value))
      .map(d => d.full)
      .join(', ');

    if (!confirm(`Add ALL ${dishesToAdd.length} dishes to ${selectedDayLabels} (${validDates.length} days) in ${format(currentMonth, 'MMMM')}?`)) return;

    setIsSaving(true);
    try {
      const inserts: any[] = [];
      validDates.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        dishesToAdd.forEach(dish => {
          if (!scheduledMenus.some(m => m.date === dateKey && m.dish_id === dish.id)) {
            inserts.push({ date: dateKey, dish_id: dish.id });
          }
        });
      });

      if (inserts.length === 0) {
        toast.info('All dishes are already scheduled on all these dates.');
        setIsSaving(false);
        return;
      }

      const res = await fetch('/api/admin/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: inserts }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setScheduledMenus(prev => [...prev, ...(data.menus || [])]);
      toast.success(`Successfully scheduled ${inserts.length} items`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to schedule bulk items');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAllMonth = async () => {
    const monthName = format(currentMonth, 'MMMM');
    const dishIds = selectedDishes.map(d => d.id);
    const isFiltered = dishIds.length > 0;
    
    const message = isFiltered 
      ? `Remove ${selectedDishes.length} selected dishes from ALL days in ${monthName}?`
      : `Remove ALL scheduled menus for ${monthName}? This cannot be undone.`;

    if (!confirm(message)) return;

    setIsSaving(true);
    try {
      const monthKey = format(currentMonth, 'yyyy-MM');
      let url = `/api/admin/menus?month=${monthKey}`;
      if (isFiltered) url += `&dish_ids=${dishIds.join(',')}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (isFiltered) {
        setScheduledMenus(prev => prev.filter(m => !dishIds.includes(m.dish_id)));
        toast.success(`Removed selected dishes for ${monthName}`);
      } else {
        setScheduledMenus([]);
        toast.success(`Removed all menus for ${monthName}`);
      }
      setSelectedDishes([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove menus');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDishSelection = (dish: any) => {
    setSelectedDishes(prev => 
      prev.some(d => d.id === dish.id) 
        ? prev.filter(d => d.id !== dish.id) 
        : [...prev, dish]
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      {isSaving && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Sidebar: Available Dishes */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        {/* Settings Box */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center gap-2 border-b pb-2">
            <Settings className="w-4 h-4" /> Planner Settings
          </h3>
          <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded-xl transition-colors">
            <input 
              type="checkbox" 
              checked={showWeekends} 
              onChange={e => handleToggleWeekends(e.target.checked)} 
              className="w-4 h-4 accent-primary" 
            />
            <span className="text-sm font-medium">Show Weekends (Sat/Sun)</span>
          </label>
        </div>

        {/* Selected Dishes Bulk Action Box */}
        {selectedDishes.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-sm animate-fade-in-up space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-xs text-primary uppercase tracking-wider">Bulk Add</h3>
                <p className="font-bold text-base leading-tight">{selectedDishes.length} dishes selected</p>
              </div>
              <button onClick={() => setSelectedDishes([])} className="text-muted-foreground hover:text-foreground p-1 rounded-md">
                <X className="w-4 h-4"/>
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">
              {selectedDishes.map(d => d.name).join(', ')}
            </p>

            {/* Day Selector */}
            <div className="space-y-1.5 pt-2 border-t border-primary/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Days to Add:</span>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setSelectedDaysOfWeek(availableDays.map(d => d.value))}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    All
                  </button>
                  <span className="text-[10px] text-muted-foreground">|</span>
                  <button 
                    type="button"
                    onClick={() => setSelectedDaysOfWeek([])}
                    className="text-[10px] text-muted-foreground hover:underline font-medium"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="flex justify-between gap-1">
                {availableDays.map(day => {
                  const isChecked = selectedDaysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        setSelectedDaysOfWeek(prev => 
                          isChecked ? prev.filter(v => v !== day.value) : [...prev, day.value]
                        );
                      }}
                      className={`
                        flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center
                        ${isChecked 
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs' 
                          : 'bg-background text-muted-foreground border-input hover:border-primary/40'}
                      `}
                    >
                      <span>{day.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Action Button */}
            {(() => {
              const validDates = getValidTargetDates(selectedDaysOfWeek);
              const isAllDaysSelected = availableDays.length === selectedDaysOfWeek.length;
              const selectedDayLabels = availableDays
                .filter(d => selectedDaysOfWeek.includes(d.value))
                .map(d => d.full)
                .join(', ');

              return (
                <div className="pt-1">
                  <button 
                    onClick={handleAddDishesToAllMonth}
                    disabled={selectedDaysOfWeek.length === 0 || validDates.length === 0}
                    className="w-full bg-primary text-primary-foreground font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarPlus className="w-4 h-4 shrink-0" />
                    {selectedDaysOfWeek.length === 0 
                      ? 'Select at least 1 day'
                      : isAllDaysSelected
                        ? `Add ${selectedDishes.length} Dish(es) to Entire Month (${validDates.length} days)`
                        : `Add ${selectedDishes.length} Dish(es) to ${selectedDayLabels} (${validDates.length} days)`
                    }
                  </button>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    {validDates.length > 0 
                      ? `Schedules onto ${validDates.length} date(s) in ${format(currentMonth, 'MMMM')}. Skips blocked dates.`
                      : 'No dates match the selected day filter.'}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col h-[600px]">
          <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
            Dishes
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-xs rounded-lg p-2 z-10 text-center">
                Click multiple dishes to bulk add to month, or drag and drop to specific days.
              </div>
            </div>
          </h3>

          <div className="flex gap-2 mb-4 shrink-0">
            <button
              onClick={handleAddAllActiveDishesToMonth}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold border rounded-xl py-2 px-3 transition-colors bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              title={`Add all ${initialDishes.length} dishes to the entire month`}
            >
              <CalendarPlus className="w-3.5 h-3.5 shrink-0" /> 
              Add All
            </button>
            {scheduledMenus.length > 0 && (
              <button
                onClick={handleRemoveAllMonth}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold border rounded-xl py-2 px-3 transition-colors ${
                  selectedDishes.length > 0 
                  ? 'text-red-700 border-red-300 bg-red-100 hover:bg-red-200' 
                  : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'
                }`}
                title={selectedDishes.length > 0 ? "Remove selected" : "Remove all scheduled dishes"}
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" /> 
                {selectedDishes.length > 0 ? 'Selected' : 'Clear All'}
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {categories.map(category => {
              const categoryDishes = initialDishes.filter(d => d.category === category);
              if (categoryDishes.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground sticky top-0 bg-card py-1 z-10 border-b">
                    {category}
                  </h4>
                  {categoryDishes.map(dish => {
                    const isSelected = selectedDishes.some(d => d.id === dish.id);
                    return (
                      <div
                        key={dish.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, dish.id)}
                        onClick={() => toggleDishSelection(dish)}
                        className={`
                          border rounded-xl p-3 flex items-center gap-3 transition-all cursor-pointer
                          ${isSelected ? 'bg-primary/10 border-primary ring-1 ring-primary shadow-sm' : 'bg-background hover:border-primary/50 hover:shadow-sm'}
                        `}
                      >
                        <div className="cursor-grab active:cursor-grabbing hover:bg-muted rounded p-1">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : ''}`}>{dish.name}</p>
                          <p className="text-xs text-muted-foreground">${Number(dish.price_regular).toFixed(2)}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content: Calendar */}
      <div className="flex-1 bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0">
        {/* Calendar Header */}
        <div className="p-4 border-b flex flex-wrap items-center justify-between bg-slate-50 gap-4">
          <h2 className="text-xl font-extrabold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentMonth(startOfMonth(new Date()))} className="px-3 py-1.5 text-sm font-semibold hover:bg-slate-200 rounded-lg transition-colors">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b bg-muted/20`}>
          {(showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} flex-1 min-h-[600px] auto-rows-fr relative`}>
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {calendarDays.map((date, i) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayOfWeek = getDay(date);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isBlocked = blockedDates.some(b => b.date === dateKey);
            const isDroppable = !isBlocked && isCurrentMonth;

            // Find menus scheduled for this day
            const dayMenus = scheduledMenus.filter(m => m.date === dateKey);

            return (
              <div
                key={i}
                onDragOver={isDroppable ? handleDragOver : undefined}
                onDrop={isDroppable ? (e) => handleDrop(e, date) : undefined}
                className={`
                  border-b border-r p-2 min-h-[120px] flex flex-col gap-1 transition-colors
                  ${!isCurrentMonth ? 'bg-slate-50/50 opacity-50' : ''}
                  ${isWeekend ? 'bg-slate-100/80' : ''}
                  ${isBlocked ? 'bg-red-50/50' : ''}
                  ${isDroppable ? 'hover:bg-primary/5' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday(date) ? 'bg-primary text-primary-foreground' : 'text-slate-500'}`}>
                    {format(date, 'd')}
                  </span>
                  {isBlocked && <span className="text-[10px] text-red-500 font-bold uppercase">Blocked</span>}
                </div>

                <div className="flex-1 flex flex-col gap-1 mt-1 overflow-y-auto">
                  {dayMenus.map(menu => (
                    <div key={menu.id} className="group relative bg-primary/10 border border-primary/20 rounded-md p-1.5 flex items-start justify-between gap-1">
                      <span className="text-xs font-bold text-primary leading-tight line-clamp-2">
                        {menu.dishes?.name}
                      </span>
                      <button 
                        onClick={() => removeMenu(menu.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 text-red-600 rounded transition-all shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
