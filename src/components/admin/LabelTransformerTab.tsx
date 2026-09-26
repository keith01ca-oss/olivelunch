'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  UploadCloud, FileUp, Sparkles, Printer, Download, Trash2, Plus, 
  ArrowUpDown, Check, RefreshCw, AlertCircle, Eye, Search, School, Calendar, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { COLOR_PALETTE, getSchoolIconName } from '@/lib/labels-shared';

export interface LabelRow {
  id: string;
  childName: string;
  division: string;
  dishName: string;
  schoolName: string;
  orderDate?: string;
  lunchTime?: string;
  isLarge?: boolean;
  notes?: string;
  color?: string;
  sourceSheet?: number;
  sourceRow?: number;
  sourceCol?: number;
}

interface LabelTransformerTabProps {
  initialSchools?: string[];
}

export default function LabelTransformerTab({ initialSchools = [] }: LabelTransformerTabProps) {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [registeredSchools, setRegisteredSchools] = useState<string[]>(initialSchools);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting controls
  const [sort1, setSort1] = useState<string>('school');
  const [sort2, setSort2] = useState<string>('division');
  const [sort3, setSort3] = useState<string>('dish');

  // Batch setters
  const [batchSchool, setBatchSchool] = useState('');
  const [batchDate, setBatchDate] = useState('');

  // Selected label for live preview inspection
  const [previewIndex, setPreviewIndex] = useState(0);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Division custom color overrides
  const [divisionColors, setDivisionColors] = useState<Record<string, string>>({});

  // Auto assign colors per division
  const computedDivColorMap = useMemo(() => {
    const uniqueDivs = Array.from(new Set(labels.map(l => l.division).filter(Boolean)));
    const map: Record<string, string> = { ...divisionColors };
    uniqueDivs.forEach((div, idx) => {
      if (!map[div]) {
        map[div] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
      }
    });
    return map;
  }, [labels, divisionColors]);

  // Handle file upload and server parsing
  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file containing Avery 5160 labels (30 per page).');
      return;
    }

    setFile(uploadedFile);
    setIsParsing(true);
    toast.info(`Parsing "${uploadedFile.name}"...`);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const res = await fetch('/api/admin/labels-transform/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse PDF labels');
      }

      const parsedLabels: LabelRow[] = (data.labels || []).map((l: any) => ({
        id: l.id || Math.random().toString(36).substring(2, 9),
        childName: l.childName || '',
        division: l.division || '',
        dishName: l.dishName || 'Lunch Meal',
        schoolName: l.schoolName || '',
        orderDate: l.orderDate || '',
        lunchTime: l.lunchTime || '',
        isLarge: Boolean(l.isLarge),
        notes: l.notes || '',
        sourceSheet: l.sourceSheet || 1,
        sourceRow: l.sourceRow || 1,
        sourceCol: l.sourceCol || 1,
      }));

      setLabels(parsedLabels);
      if (data.registeredSchools && data.registeredSchools.length > 0) {
        setRegisteredSchools(data.registeredSchools);
      }
      setPreviewIndex(0);

      toast.success(`Successfully parsed ${parsedLabels.length} labels across ${data.totalPages || 1} sheet(s)!`);
    } catch (err: any) {
      toast.error(err.message || 'Error parsing label PDF');
    } finally {
      setIsParsing(false);
    }
  };

  // Demo sample loader
  const loadDemoData = () => {
    const demoSchools = registeredSchools.length > 0 
      ? registeredSchools 
      : ['Olive Elementary School', 'Maple Secondary School'];
    
    const sampleItems: LabelRow[] = [
      { id: '1', childName: 'Emma Watson', division: 'DIV 4', dishName: 'Teriyaki Chicken Rice Bowl', schoolName: demoSchools[0], isLarge: true, lunchTime: '11:45 AM', orderDate: 'Oct 15' },
      { id: '2', childName: 'Liam Miller', division: 'DIV 4', dishName: 'Cheese Pizza Slice (2 pcs)', schoolName: demoSchools[0], isLarge: false, lunchTime: '11:45 AM', orderDate: 'Oct 15' },
      { id: '3', childName: 'Sophia Chen', division: 'DIV 2', dishName: 'Beef Lasagna with Garlic Bread', schoolName: demoSchools[0], isLarge: false, lunchTime: '11:45 AM', orderDate: 'Oct 15' },
      { id: '4', childName: 'Noah Davis', division: 'DIV 2', dishName: 'Crispy Chicken Burger', schoolName: demoSchools[0], isLarge: true, lunchTime: '11:45 AM', orderDate: 'Oct 15' },
      { id: '5', childName: 'Olivia Taylor', division: 'DIV 7', dishName: 'Vegetarian Pasta Primavera', schoolName: demoSchools[0], isLarge: false, lunchTime: '12:00 PM', orderDate: 'Oct 15' },
      { id: '6', childName: 'Lucas Anderson', division: 'DIV 7', dishName: 'Teriyaki Chicken Rice Bowl', schoolName: demoSchools[0], isLarge: false, lunchTime: '12:00 PM', orderDate: 'Oct 15' },
      { id: '7', childName: 'Ava Johnson', division: 'DIV 1', dishName: 'Sushi Combo (California & Salmon)', schoolName: demoSchools[1] || demoSchools[0], isLarge: true, lunchTime: '12:15 PM', orderDate: 'Oct 15' },
      { id: '8', childName: 'Ethan Brown', division: 'DIV 1', dishName: 'Macaroni & Cheese Bowl', schoolName: demoSchools[1] || demoSchools[0], isLarge: false, lunchTime: '12:15 PM', orderDate: 'Oct 15' },
    ];
    setLabels(sampleItems);
    setPreviewIndex(0);
    toast.success('Loaded 8 sample labels for testing.');
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Update single label
  const updateLabel = (id: string, updates: Partial<LabelRow>) => {
    setLabels(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)));
  };

  // Delete single label
  const deleteLabel = (id: string) => {
    setLabels(prev => prev.filter(l => l.id !== id));
    toast.info('Label removed');
  };

  // Add empty label
  const addNewLabel = () => {
    const newLbl: LabelRow = {
      id: Math.random().toString(36).substring(2, 9),
      childName: 'STUDENT NAME',
      division: 'DIV 1',
      dishName: 'Meal Item',
      schoolName: registeredSchools[0] || 'School Name',
      isLarge: false,
      orderDate: batchDate || '',
    };
    setLabels(prev => [newLbl, ...prev]);
    setPreviewIndex(0);
  };

  // Batch actions
  const applyBatchSchool = () => {
    if (!batchSchool) return;
    setLabels(prev => prev.map(l => ({ ...l, schoolName: batchSchool })));
    toast.success(`Updated school to "${batchSchool}" for all labels.`);
  };

  const applyBatchDate = () => {
    if (!batchDate) return;
    setLabels(prev => prev.map(l => ({ ...l, orderDate: batchDate })));
    toast.success(`Updated date to "${batchDate}" for all labels.`);
  };

  // Filter & Sorted labels
  const sortedLabels = useMemo(() => {
    const copy = [...labels];
    const getSortVal = (l: LabelRow, field: string): string => {
      if (field === 'school') return l.schoolName || '';
      if (field === 'division') return l.division || '';
      if (field === 'dish') return l.dishName || '';
      if (field === 'childName') return l.childName || '';
      if (field === 'date') return l.orderDate || '';
      return '';
    };

    const activeSorts = [sort1, sort2, sort3].filter(Boolean);
    if (activeSorts.length > 0) {
      copy.sort((a, b) => {
        for (const sf of activeSorts) {
          const cmp = getSortVal(a, sf).localeCompare(getSortVal(b, sf));
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    return copy;
  }, [labels, sort1, sort2, sort3]);

  const filteredLabels = useMemo(() => {
    if (!searchQuery) return sortedLabels;
    const q = searchQuery.toLowerCase();
    return sortedLabels.filter(
      l =>
        l.childName.toLowerCase().includes(q) ||
        l.division.toLowerCase().includes(q) ||
        l.dishName.toLowerCase().includes(q) ||
        l.schoolName.toLowerCase().includes(q)
    );
  }, [sortedLabels, searchQuery]);

  // Export to Olive Lunch Avery 5160 PDF
  const handleExportPDF = async () => {
    if (labels.length === 0) {
      toast.error('No labels to export.');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Generating styled Avery 5160 PDF...');

    try {
      // Pass color overrides attached to each label
      const payloadLabels = sortedLabels.map(l => ({
        ...l,
        color: computedDivColorMap[l.division] || '#3b6fd4',
      }));

      const res = await fetch('/api/admin/labels-transform/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labels: payloadLabels,
          sortFields: [sort1, sort2, sort3].filter(Boolean),
          date: batchDate || '',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `olive-labels-${batchDate || new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Avery 5160 PDF exported successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Current active preview label
  const activePreviewLabel = filteredLabels[previewIndex] || filteredLabels[0] || null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Avery 5160 • 30 Per Page
              </span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
                Auto Color Lines &amp; Div Squares
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Label Transformer &amp; PDF Re-Exporter
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Upload any existing 30-per-page label PDF (e.g. from an external lunch system or raw Avery sheet).
              We parse every label, sort them by school and division, inject our signature 
              <strong className="text-emerald-700"> color indicator lines</strong> and 
              <strong className="text-emerald-700"> division squares</strong>, and export cleanly to the Olive Lunch standard format.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              Upload PDF Sheet
            </button>
            <button
              onClick={loadDemoData}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Load Sample Demo
            </button>
          </div>
        </div>
      </div>

      {/* Upload Drop Zone (Visible when no labels or user wants to re-upload) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {labels.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-3 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-emerald-400 bg-card hover:bg-slate-50/50'
          }`}
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <FileUp className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">
                {isParsing ? 'Processing and reading PDF coordinates...' : 'Drop your 30-per-page label PDF here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Standard Avery 5160 format (8.5&quot; × 11&quot;, 3 columns × 10 rows). Click to browse from your computer.
              </p>
            </div>
            {isParsing && (
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100/60 px-3 py-1.5 rounded-full animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Extracting labels and positioning coordinates...
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Workspace when labels are loaded */
        <div className="space-y-6">
          {/* Top Control Bar: File Info + Stats + Quick Actions */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                {labels.length}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">
                  {file ? file.name : 'Loaded Labels'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {labels.length} total labels • {Math.ceil(labels.length / 30)} Avery sheets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-muted-foreground hover:text-foreground border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" /> Replace PDF
              </button>
              <button
                onClick={addNewLabel}
                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Label
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Generating PDF...' : 'Export Avery 5160 PDF'}
              </button>
            </div>
          </div>

          {/* Grid of Preview Card + Sorting / Batch Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Live Interactive Label Preview (4 cols on lg) */}
            <div className="lg:col-span-4 bg-card border rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Live Avery 5160 Preview</h3>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground">
                  #{previewIndex + 1} of {filteredLabels.length}
                </span>
              </div>

              {activePreviewLabel ? (
                <div className="space-y-4">
                  {/* The exact Avery 5160 Physical Card Mockup (2.625" x 1.0" aspect ratio) */}
                  <div className="relative w-full aspect-[2.625/1] bg-white border border-slate-300 rounded-lg p-2.5 shadow-md flex flex-col justify-between overflow-hidden">
                    {/* Left Color Strip */}
                    <div 
                      className="absolute left-1.5 top-1.5 bottom-1.5 w-1 rounded-full transition-colors"
                      style={{ backgroundColor: computedDivColorMap[activePreviewLabel.division] || '#3b6fd4' }}
                    />

                    {/* Line 1: Child Name + Lunch Time + Division Badge */}
                    <div className="pl-3 flex items-start justify-between gap-1 leading-none">
                      <div className="font-black text-[11px] tracking-tight uppercase truncate flex-1 text-black">
                        {activePreviewLabel.childName || 'STUDENT NAME'}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {activePreviewLabel.lunchTime && (
                          <span className="text-[9px] font-black text-black">
                            {activePreviewLabel.lunchTime}
                          </span>
                        )}
                        <span 
                          className="text-[9px] font-black px-1.5 py-0.5 rounded border border-black/80 bg-white leading-none"
                          style={{ borderColor: computedDivColorMap[activePreviewLabel.division] || '#333' }}
                        >
                          {activePreviewLabel.division || 'DIV'}
                        </span>
                      </div>
                    </div>

                    {/* Line 2 & 3: Dish Name */}
                    <div className="pl-3 font-extrabold text-[10.5px] leading-tight text-black line-clamp-2">
                      {activePreviewLabel.dishName || 'Item Name'}
                      {activePreviewLabel.isLarge && (
                        <span className="ml-1 text-rose-600 font-black text-[10px]">( Lg )</span>
                      )}
                    </div>

                    {/* Line 4: School Icon + School Name */}
                    <div className="pl-3 flex items-center gap-1.5 leading-none">
                      <span className="text-[11px] font-black">★</span>
                      <span className="font-black text-[9px] uppercase tracking-tight truncate text-black">
                        {activePreviewLabel.schoolName || 'SCHOOL NAME'}
                      </span>
                    </div>

                    {/* Line 5: Date */}
                    <div className="pl-3 flex items-center justify-between text-[8px] font-black text-black leading-none pt-0.5 border-t border-slate-100">
                      <span>Rt 1</span>
                      <span>{activePreviewLabel.orderDate || 'Date'}</span>
                    </div>
                  </div>

                  {/* Navigation arrows for preview */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                      disabled={previewIndex <= 0}
                      className="px-2.5 py-1 rounded-lg border bg-muted/50 hover:bg-muted font-bold disabled:opacity-40"
                    >
                      ← Previous
                    </button>
                    <span className="text-muted-foreground font-medium text-[11px]">
                      Select any row in the table below to preview
                    </span>
                    <button
                      onClick={() => setPreviewIndex(prev => Math.min(filteredLabels.length - 1, prev + 1))}
                      disabled={previewIndex >= filteredLabels.length - 1}
                      className="px-2.5 py-1 rounded-lg border bg-muted/50 hover:bg-muted font-bold disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No labels to preview.</p>
              )}

              {/* Division Color Palette Legend & Customizer */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                  Division Color Coding
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(computedDivColorMap).map(([div, color]) => (
                    <div
                      key={div}
                      className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2 py-1 text-xs font-bold"
                    >
                      <input
                        type="color"
                        value={color}
                        onChange={e => {
                          setDivisionColors(prev => ({ ...prev, [div]: e.target.value }));
                        }}
                        className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                        title="Click to change color"
                      />
                      <span className="text-slate-800">{div}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sorting & Batch Tooling (8 cols on lg) */}
            <div className="lg:col-span-8 bg-card border rounded-3xl p-5 shadow-sm space-y-5">
              {/* Sorting Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Sort Order (Cascading)
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">1st Sort</label>
                    <select
                      value={sort1}
                      onChange={e => setSort1(e.target.value)}
                      className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="school">School Name</option>
                      <option value="division">Division / Class</option>
                      <option value="dish">Dish / Item Name</option>
                      <option value="childName">Student Name</option>
                      <option value="date">Date</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">2nd Sort</label>
                    <select
                      value={sort2}
                      onChange={e => setSort2(e.target.value)}
                      className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">— None —</option>
                      <option value="division">Division / Class</option>
                      <option value="school">School Name</option>
                      <option value="dish">Dish / Item Name</option>
                      <option value="childName">Student Name</option>
                      <option value="date">Date</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">3rd Sort</label>
                    <select
                      value={sort3}
                      onChange={e => setSort3(e.target.value)}
                      className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">— None —</option>
                      <option value="dish">Dish / Item Name</option>
                      <option value="childName">Student Name</option>
                      <option value="division">Division / Class</option>
                      <option value="school">School Name</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Batch Fill Bar */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  Batch Setters (Apply to All Labels)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Set School */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="School name (e.g. Westwind)"
                        value={batchSchool}
                        onChange={e => setBatchSchool(e.target.value)}
                        list="registered-schools-list"
                        className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium outline-none"
                      />
                      <datalist id="registered-schools-list">
                        {registeredSchools.map(s => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <button
                      onClick={applyBatchSchool}
                      className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold whitespace-nowrap shadow-sm"
                    >
                      Set School
                    </button>
                  </div>

                  {/* Set Date */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Date (e.g. Oct 15 or 2026-10-15)"
                      value={batchDate}
                      onChange={e => setBatchDate(e.target.value)}
                      className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium outline-none"
                    />
                    <button
                      onClick={applyBatchDate}
                      className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold whitespace-nowrap shadow-sm"
                    >
                      Set Date
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Editable Table of All Labels */}
          <div className="bg-card border rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">Labels Data Table</h3>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground">
                  {filteredLabels.length} {filteredLabels.length === 1 ? 'label' : 'labels'}
                </span>
              </div>

              {/* Search filter input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter student, dish, div..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-black uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Student Name</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Division</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Dish / Item Name</th>
                    <th className="py-2.5 px-3 min-w-[140px]">School</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Date / Time</th>
                    <th className="py-2.5 px-3 w-16 text-center">Large?</th>
                    <th className="py-2.5 px-3 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLabels.map((lbl, idx) => {
                    const isSelected = previewIndex === idx;
                    const divColor = computedDivColorMap[lbl.division] || '#3b6fd4';

                    return (
                      <tr 
                        key={lbl.id}
                        onClick={() => setPreviewIndex(idx)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/80 hover:bg-emerald-50' : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-muted-foreground text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Student Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={lbl.childName}
                            onChange={e => updateLabel(lbl.id, { childName: e.target.value })}
                            className="w-full font-bold uppercase bg-transparent hover:bg-white focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-none text-xs"
                          />
                        </td>

                        {/* Division */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: divColor }} 
                            />
                            <input
                              type="text"
                              value={lbl.division}
                              onChange={e => updateLabel(lbl.id, { division: e.target.value.toUpperCase() })}
                              className="w-full font-black bg-transparent hover:bg-white focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-none text-xs"
                            />
                          </div>
                        </td>

                        {/* Dish Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={lbl.dishName}
                            onChange={e => updateLabel(lbl.id, { dishName: e.target.value })}
                            className="w-full bg-transparent hover:bg-white focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-none text-xs"
                          />
                        </td>

                        {/* School */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={lbl.schoolName}
                            onChange={e => updateLabel(lbl.id, { schoolName: e.target.value })}
                            className="w-full bg-transparent hover:bg-white focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-none text-xs text-muted-foreground"
                          />
                        </td>

                        {/* Date / Time */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={lbl.orderDate || lbl.lunchTime || ''}
                            onChange={e => updateLabel(lbl.id, { orderDate: e.target.value })}
                            placeholder="Optional"
                            className="w-full bg-transparent hover:bg-white focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-input outline-none text-xs text-muted-foreground"
                          />
                        </td>

                        {/* Large toggle */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(lbl.isLarge)}
                            onChange={e => updateLabel(lbl.id, { isLarge: e.target.checked })}
                            className="rounded border-input text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                          />
                        </td>

                        {/* Delete action */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              deleteLabel(lbl.id);
                            }}
                            className="text-muted-foreground hover:text-rose-600 p-1 rounded transition-colors"
                            title="Delete label"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Export Action Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {filteredLabels.length} of {labels.length} total labels. Formatted with Avery 5160 dimensions.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl border bg-muted/50 hover:bg-muted font-bold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Page
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Generating PDF...' : 'Export Avery 5160 PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
