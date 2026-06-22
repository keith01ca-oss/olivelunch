import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 1. Look up the organization by slug
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single();

  if (error || !org) {
    // If the company doesn't exist, send them to the homepage
    return NextResponse.redirect(new URL('/?error=org_not_found', request.url));
  }

  // 2. Set the organization context in a cookie and redirect
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  
  response.cookies.set('olive_org_id', org.id, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set('olive_org_name', org.name, { path: '/', maxAge: 60 * 60 * 24 * 30 });

  return response;
}
