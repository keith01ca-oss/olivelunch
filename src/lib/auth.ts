import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';

export type UserRole = 'parent' | 'admin' | 'kitchen';

export interface AuthContext {
  clerkUserId: string;
  role: UserRole;
  parentId: string | null;
}

/**
 * Resolves the default organization ID from cookies or queries the 'olive-lunch' slug from the database.
 */
export async function getOrResolveOrgId(): Promise<string> {
  // Query the 'olive-lunch' slug from the database as the default single-tenant organization
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', 'olive-lunch')
    .single();

  if (org) {
    return org.id;
  }

  // Secondary fallback: query the first available organization
  const { data: firstOrg } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .limit(1);

  if (firstOrg && firstOrg.length > 0) {
    return firstOrg[0].id;
  }

  // Return a fallback ID if the default org is not found yet
  return '00000000-0000-0000-0000-000000000000';
}

/**
 * Validates the current Clerk session and resolves the Supabase parent_id.
 * This pattern MUST be used in all API routes accessing parent data.
 */
export async function getResolvedParent(): Promise<AuthContext | { error: string; status: number }> {
  // 1. Verify Clerk session
  const session = await auth();
  const clerkUserId = session.userId;
  
  if (!clerkUserId) {
    return { error: 'Unauthorized - No Clerk Session', status: 401 };
  }

  // 2. Extract Role (from Clerk Session Claims)
  const role = ((session.sessionClaims?.metadata as any)?.role as UserRole) || 'parent';

  // 3. Resolve parent_id from clerk_user_id
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id')
    .eq('clerk_user_id', clerkUserId);

  if (error) {
    console.error('Database error looking up parent:', error);
    return { error: `Failed to look up parent profile: ${error.message}`, status: 500 };
  }

  const parent = parents?.[0];

  if (!parent) {
    if (role === 'admin' || role === 'kitchen') {
      return { clerkUserId, role, parentId: null };
    }
    
    // Auto-provision the parent row on first login
    const user = await currentUser();
    if (!user) return { error: 'Clerk User details not found', status: 401 };

    const email = user.emailAddresses[0]?.emailAddress;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'New Parent';

    // Generate a unique referral code based on name + random suffix
    const namePart = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || 'USER';
    const referralCode = `${namePart}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Check if this new user was referred by someone (cookie set by /refer/[code])
    const cookieStore = await cookies();
    const refCode = cookieStore.get('olive_ref')?.value?.toUpperCase();
    let referredById: string | null = null;
    if (refCode) {
      const { data: referrer } = await supabaseAdmin
        .from('parents')
        .select('id')
        .eq('referral_code', refCode)
        .single();
      if (referrer) referredById = referrer.id;
    }

    // Try to get org_id, but don't fail if the organizations table doesn't exist
    let resolvedOrgId: string | null = null;
    try {
      const orgId = await getOrResolveOrgId();
      // Only use it if it's a real ID (not the zero-UUID fallback)
      if (orgId && orgId !== '00000000-0000-0000-0000-000000000000') {
        resolvedOrgId = orgId;
      }
    } catch {
      // organizations table might not exist yet — that's okay
    }

    const insertPayload = {
      clerk_user_id: clerkUserId,
      email: email || '',
      name: name,
      org_id: resolvedOrgId || '00000000-0000-0000-0000-000000000000',
      is_vip: false as boolean,
      referral_code: referralCode,
      referred_by: referredById,
    };

    const { data: newParent, error: insertError } = await supabaseAdmin
      .from('parents')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !newParent) {
      const isEmailConflict = insertError?.code === '23505' && insertError?.message?.includes('email');
      const isClerkIdConflict = insertError?.code === '23505' && insertError?.message?.includes('clerk_user_id');

      if (isEmailConflict && insertPayload.email) {
        const { data: existingByEmail, error: lookupError } = await supabaseAdmin
          .from('parents')
          .select('id')
          .eq('email', insertPayload.email)
          .single();

        if (!lookupError && existingByEmail) {
          // Re-link this Clerk user ID to the existing parent row
          await supabaseAdmin
            .from('parents')
            .update({ clerk_user_id: clerkUserId })
            .eq('id', existingByEmail.id);

          console.log(`Re-linked clerk_user_id for parent ${existingByEmail.id} (email: ${insertPayload.email})`);
          return { clerkUserId, role, parentId: existingByEmail.id };
        }
      } else if (isClerkIdConflict) {
        // Race condition: another parallel request just provisioned the user. Fetch the newly created parent.
        const { data: existingByClerkId, error: lookupError } = await supabaseAdmin
          .from('parents')
          .select('id')
          .eq('clerk_user_id', clerkUserId)
          .single();

        if (!lookupError && existingByClerkId) {
          console.log(`Resolved clerk_user_id race condition for parent ${existingByClerkId.id}`);
          return { clerkUserId, role, parentId: existingByClerkId.id };
        }
      }

      console.error('Failed to provision parent:', JSON.stringify(insertError), 'Payload:', JSON.stringify(insertPayload));
      return { error: `Failed to create parent profile: ${insertError?.message || 'unknown error'}`, status: 500 };
    }

    return { clerkUserId, role, parentId: newParent.id };
  }

  return { clerkUserId, role, parentId: parent.id };
}

/**
 * Enforces that the user has the 'admin' role.
 */
export async function requireAdmin() {
  const context = await getResolvedParent();
  if ('error' in context) return context;
  if (context.role !== 'admin') return { error: 'Forbidden - Admins only', status: 403 };
  return context;
}

/**
 * Enforces that the user has the 'kitchen' role (or admin).
 */
export async function requireKitchen() {
  const context = await getResolvedParent();
  if ('error' in context) return context;
  if (context.role !== 'kitchen' && context.role !== 'admin') {
    return { error: 'Forbidden - Kitchen staff only', status: 403 };
  }
  return context;
}

/**
 * Verifies the caller is a super-admin (in ADMIN_CLERK_USER_IDS env var).
 * Use this in server actions and API routes that require admin access.
 * Throws an Error on failure (compatible with server actions that return { error } and API routes).
 */
export async function verifyAdmin(): Promise<void> {
  const authContext = await getResolvedParent();
  if ('error' in authContext) {
    throw new Error('Unauthorized');
  }
  const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const isSuperAdmin = allowedIds.length > 0 && allowedIds.includes(authContext.clerkUserId);
  if (!isSuperAdmin) {
    throw new Error('Forbidden');
  }
}

/**
 * Same as verifyAdmin() but returns { error, status } instead of throwing.
 * Use this at the top of Next.js API route handlers.
 */
export async function verifyAdminRoute(): Promise<{ error: string; status: number } | null> {
  try {
    await verifyAdmin();
    return null;
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 403;
    return { error: err.message, status };
  }
}
