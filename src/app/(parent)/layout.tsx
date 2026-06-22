import { ParentNavbar } from '@/components/layout/ParentNavbar';
import { getResolvedParent } from '@/lib/auth';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getResolvedParent();
  let isAdmin = false;

  if (!('error' in authContext)) {
    // Check if admin via ADMIN_CLERK_USER_IDS env var (B2B setup)
    const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (allowedIds.includes(authContext.clerkUserId)) {
      isAdmin = true;
    }
    // Also check role from session claims (set by Clerk JWT template)
    if (authContext.role === 'admin' || authContext.role === 'kitchen') {
      isAdmin = true;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <ParentNavbar isAdmin={isAdmin} />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8 animate-fade-in-up">
        {children}
      </main>
    </div>
  );
}
