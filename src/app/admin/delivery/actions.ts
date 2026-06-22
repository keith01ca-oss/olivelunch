'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

// -- ROUTES --

export async function createRoute(orgId: string, routeNumber: string) {
  if (!orgId) return { error: 'Organization ID is required' };
  if (!routeNumber.trim()) return { error: 'Route number is required' };
  
  const { data, error } = await supabaseAdmin
    .from('routes')
    .insert([{ org_id: orgId, route_number: routeNumber.trim() }])
    .select()
    .single();
    
  if (error) {
    console.error('Error creating route:', error);
    return { error: 'Failed to create route' };
  }
  
  revalidatePath('/admin/delivery');
  return { success: true, data };
}

export async function deleteRoute(id: string) {
  const { error } = await supabaseAdmin
    .from('routes')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting route:', error);
    return { error: 'Failed to delete route. Ensure no schools are still linked to it.' };
  }
  
  revalidatePath('/admin/delivery');
  return { success: true };
}

// -- SCHOOLS --

export async function createSchool(orgId: string, name: string, routeId?: string, stopOrder: number = 0) {
  if (!orgId) return { error: 'Organization ID is required' };
  if (!name.trim()) return { error: 'School name is required' };
  
  const { data: school, error: schoolError } = await supabaseAdmin
    .from('schools')
    .insert([{ org_id: orgId, name: name.trim() }])
    .select()
    .single();
    
  if (schoolError || !school) {
    console.error('Error creating school:', schoolError);
    return { error: 'Failed to create school' };
  }
  
  if (routeId) {
    const { error: routeError } = await supabaseAdmin
      .from('school_routes')
      .insert([{ school_id: school.id, route_id: routeId, stop_order: stopOrder }]);
      
    if (routeError) {
       console.error('Error linking route:', routeError);
    }
  }
  
  revalidatePath('/admin/delivery');
  return { success: true, data: school };
}

export async function deleteSchool(id: string) {
  const { error } = await supabaseAdmin
    .from('schools')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting school:', error);
    return { error: 'Failed to delete school. Make sure no children are assigned to it.' };
  }
  
  revalidatePath('/admin/delivery');
  return { success: true };
}

export async function updateSchoolRoute(schoolId: string, newRouteId: string, stopOrder: number = 0) {
  // First, delete existing mapping
  await supabaseAdmin
    .from('school_routes')
    .delete()
    .eq('school_id', schoolId);
    
  // If not setting to empty, insert new
  if (newRouteId && newRouteId !== 'unassigned') {
    const { error } = await supabaseAdmin
      .from('school_routes')
      .insert([{ school_id: schoolId, route_id: newRouteId, stop_order: stopOrder }]);
      
    if (error) {
      console.error('Error assigning route:', error);
      return { error: 'Failed to assign route' };
    }
  }
  
  revalidatePath('/admin/delivery');
  return { success: true };
}
