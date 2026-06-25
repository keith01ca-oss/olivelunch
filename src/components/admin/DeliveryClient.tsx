'use client';

import { useState } from 'react';
import { Truck, MapPin, Plus, Trash2, Link as LinkIcon, School, ToggleLeft, ToggleRight } from 'lucide-react';
import { createRoute, deleteRoute, createSchool, deleteSchool, updateSchoolRoute, updateSchoolActive } from '@/app/admin/delivery/actions';

interface Route {
  id: string;
  route_number: string;
}

interface SchoolItem {
  id: string;
  name: string;
  isActive: boolean;
  assignedRouteId: string | null;
  stopOrder: number;
}

interface Props {
  initialRoutes: Route[];
  initialSchools: SchoolItem[];
  orgId: string;
}

export default function DeliveryClient({ initialRoutes, initialSchools, orgId }: Props) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [schools, setSchools] = useState<SchoolItem[]>(initialSchools);
  
  const [newRouteNumber, setNewRouteNumber] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolRoute, setNewSchoolRoute] = useState('');
  const [newSchoolStop, setNewSchoolStop] = useState<number>(0);

  const handleCreateRoute = async () => {
    if (!newRouteNumber) return;
    const res = await createRoute(orgId, newRouteNumber);
    if (res.error) return alert(res.error);
    if (res.data) {
      setRoutes([...routes, res.data]);
      setNewRouteNumber('');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route? Ensure no schools are linked to it first.')) return;
    const res = await deleteRoute(id);
    if (res.error) return alert(res.error);
    setRoutes(routes.filter(r => r.id !== id));
  };

  const handleCreateSchool = async () => {
    if (!newSchoolName) return;
    const res = await createSchool(orgId, newSchoolName, newSchoolRoute || undefined, newSchoolStop);
    if (res.error) return alert(res.error);
    if (res.data) {
      setSchools([...schools, { 
        id: res.data.id, 
        name: res.data.name, 
        isActive: res.data.is_active !== false,
        assignedRouteId: newSchoolRoute || null, 
        stopOrder: newSchoolStop 
      }]);
      setNewSchoolName('');
      setNewSchoolRoute('');
      setNewSchoolStop(0);
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this school? Ensure no children are currently assigned to it.')) return;
    const res = await deleteSchool(id);
    if (res.error) return alert(res.error);
    setSchools(schools.filter(s => s.id !== id));
  };

  const handleToggleSchoolActive = async (schoolId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    const res = await updateSchoolActive(schoolId, nextActive);
    if (res.error) return alert(res.error);
    setSchools(schools.map(s => s.id === schoolId ? { ...s, isActive: nextActive } : s));
  };

  const handleUpdateSchoolRoute = async (schoolId: string, routeId: string, stopOrder: number) => {
    const res = await updateSchoolRoute(schoolId, routeId, stopOrder);
    if (res.error) return alert(res.error);
    setSchools(schools.map(s => s.id === schoolId ? { ...s, assignedRouteId: routeId === 'unassigned' ? null : routeId, stopOrder } : s));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Management</h1>
        <p className="text-muted-foreground mt-1">Manage delivery routes and assign schools to them.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* ROUTES PANEL */}
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[700px]">
            <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-bold text-lg">Delivery Routes</h2>
            </div>
            
            <div className="p-4 border-b bg-muted/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="E.g. Route A, Route 1"
                  value={newRouteNumber}
                  onChange={e => setNewRouteNumber(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleCreateRoute}
                  className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {routes.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No routes created yet.</p>
              ) : routes.map(route => {
                const schoolCount = schools.filter(s => s.assignedRouteId === route.id).length;
                return (
                  <div key={route.id} className="flex items-center justify-between p-3 rounded-xl border bg-background hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                        {route.route_number.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold">{route.route_number}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <School className="w-3 h-3" /> {schoolCount} school{schoolCount !== 1 ? 's' : ''} assigned
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete Route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SCHOOLS PANEL */}
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[700px]">
            <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="font-bold text-lg">Schools</h2>
            </div>
            
            <div className="p-4 border-b bg-muted/10 space-y-3">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="School Name"
                  value={newSchoolName}
                  onChange={e => setNewSchoolName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <select
                    value={newSchoolRoute}
                    onChange={e => setNewSchoolRoute(e.target.value)}
                    className="flex-[2] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary text-muted-foreground"
                  >
                    <option value="">Assign Route (Optional)</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.route_number}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="Stop #"
                    value={newSchoolStop || ''}
                    onChange={e => setNewSchoolStop(parseInt(e.target.value) || 0)}
                    className="flex-[1] w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                    title="Stop Sequence Number"
                  />
                  <button
                    onClick={handleCreateSchool}
                    className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {schools.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No schools created yet.</p>
              ) : schools.map(school => (
                <div key={school.id} className={`flex flex-col p-3 rounded-xl border bg-background hover:border-primary/40 transition-colors gap-3 ${!school.isActive ? 'opacity-60 bg-muted/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm ${!school.isActive ? 'text-muted-foreground' : ''}`}>{school.name}</p>
                      {!school.isActive && (
                        <span className="text-[10px] font-extrabold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleSchoolActive(school.id, school.isActive)}
                        className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                        title={school.isActive ? 'Deactivate School' : 'Activate School'}
                      >
                        {school.isActive ? (
                          <ToggleRight className="w-4 h-4 text-primary" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSchool(school.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        title="Delete School"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <select
                      value={school.assignedRouteId || 'unassigned'}
                      onChange={(e) => handleUpdateSchoolRoute(school.id, e.target.value, school.stopOrder)}
                      className="flex-1 rounded-md border border-input bg-muted/30 px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <option value="unassigned">Unassigned</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.route_number}</option>
                      ))}
                    </select>
                    
                    {school.assignedRouteId && (
                      <div className="flex items-center gap-1 border-l pl-2 border-border ml-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Stop</span>
                        <input
                          type="number"
                          min="0"
                          value={school.stopOrder}
                          onChange={(e) => handleUpdateSchoolRoute(school.id, school.assignedRouteId!, parseInt(e.target.value) || 0)}
                          className="w-12 text-center rounded-md border border-input bg-muted/30 px-1 py-1 text-xs font-bold focus:ring-1 focus:ring-primary hover:bg-muted/50"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
