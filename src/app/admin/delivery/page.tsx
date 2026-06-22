import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import DeliveryClient from '@/components/admin/DeliveryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDeliveryPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');
  const orgId = await getOrResolveOrgId();

  // Fetch all routes
  const { data: routes } = await supabaseAdmin
    .from('routes')
    .select('*')
    .order('route_number')
    .eq('org_id', orgId);

  // Fetch all schools
  const { data: schools } = await supabaseAdmin
    .from('schools')
    .select('*')
    .order('name')
    .eq('org_id', orgId);

  // Fetch school routes mapping
  const { data: schoolRoutes } = await supabaseAdmin
    .from('school_routes')
    .select('*');

  // Map the schools to include their assigned route and stop_order
  const mappedSchools = (schools || []).map(school => {
    const mapping = (schoolRoutes || []).find(sr => sr.school_id === school.id);
    return {
      id: school.id,
      name: school.name,
      assignedRouteId: mapping ? mapping.route_id : null,
      stopOrder: mapping ? mapping.stop_order : 0
    };
  });

  return (
    <DeliveryClient 
      initialRoutes={routes || []} 
      initialSchools={mappedSchools} 
      orgId={orgId}
    />
  );
}
