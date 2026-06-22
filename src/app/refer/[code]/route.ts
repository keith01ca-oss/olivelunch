import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// This endpoint is hit when a new visitor clicks a referral link: /refer/CODE
// It validates the code and stores it in a cookie so it gets applied when they sign up.
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase();

  if (!code) {
    return NextResponse.redirect(new URL('/sign-up', req.url));
  }

  // Validate the code exists
  const { data: referrer } = await supabaseAdmin
    .from('parents')
    .select('id, name')
    .eq('referral_code', code)
    .single();

  const signUpUrl = new URL('/sign-up', req.url);

  if (!referrer) {
    // Code doesn't exist, just redirect to sign-up
    return NextResponse.redirect(signUpUrl);
  }

  // Store the referral code in a cookie so auth.ts can pick it up at registration
  const res = NextResponse.redirect(signUpUrl);
  res.cookies.set('olive_ref', code, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    httpOnly: false,
  });

  return res;
}
