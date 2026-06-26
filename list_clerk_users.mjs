// Fetch all Clerk users and find ones with keith01.ca@gmail.com to get the new Google OAuth user ID
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'YOUR_CLERK_SECRET_KEY_HERE';

const response = await fetch('https://api.clerk.com/v1/users?limit=50&order_by=-created_at', {
  headers: {
    'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }
});

const data = await response.json();

console.log('\n=== CLERK PRODUCTION USERS ===');
for (const user of data) {
  const emails = user.email_addresses?.map(e => e.email_address) || [];
  const externalAccounts = user.external_accounts?.map(a => `${a.provider}:${a.email_address}`) || [];
  console.log(`ID: ${user.id}`);
  console.log(`  Emails: ${emails.join(', ')}`);
  console.log(`  External: ${externalAccounts.join(', ') || 'none'}`);
  console.log(`  Created: ${new Date(user.created_at).toISOString()}`);
  console.log('---');
}
