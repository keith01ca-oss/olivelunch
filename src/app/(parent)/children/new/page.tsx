import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function NewChildPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { parentId } = authContext;
  const orgId = await getOrResolveOrgId();

  // Fetch available schools for this org
  const schoolQuery = supabaseAdmin
    .from('schools')
    .select('id, name')
    .order('name')
    .eq('org_id', orgId);
  const { data: schools } = await schoolQuery;

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add a Child</h1>
        <p className="text-muted-foreground mt-1">Register your child to start ordering their lunch.</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <form action="/api/children" method="POST" className="space-y-6">
          <input type="hidden" name="parentId" value={parentId!} />
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none">
              Child's Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Olivia Leung"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="schoolId" className="text-sm font-medium leading-none">
              School
            </label>
            <select
              id="schoolId"
              name="schoolId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue=""
            >
              <option value="" disabled>Select a school...</option>
              {schools?.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="division" className="text-sm font-medium leading-none">
              Division / Class
            </label>
            <input
              type="text"
              id="division"
              name="division"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. 3N"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="deliveryLocation" className="text-sm font-medium leading-none">
              Delivery Location
            </label>
            <p className="text-[0.8rem] text-muted-foreground mb-2">
              Where should your lunch be delivered at school normally? Please check with the school office they will let you know where to send your child's lunch.
            </p>
            <input
              type="text"
              id="deliveryLocation"
              name="deliveryLocation"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Classroom / Office / Box by entrance / Designated area - please specify"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lunchTime" className="text-sm font-medium leading-none">
              Lunch Time
            </label>
            <input
              type="text"
              id="lunchTime"
              name="lunchTime"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. 11:30 AM"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors mt-8"
          >
            Save Child
          </button>
        </form>
      </div>
    </div>
  );
}
