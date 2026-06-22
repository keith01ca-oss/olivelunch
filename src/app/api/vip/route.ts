import { NextRequest, NextResponse } from 'next/server';
import { getResolvedParent } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export async function POST(req: NextRequest) {
  const authContext = await getResolvedParent();
  
  if ('error' in authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { parentId } = authContext;

  try {
    const formData = await req.formData().catch(() => new FormData());
    const plan = formData.get('plan') as string;
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    
    let priceId = '';
    if (plan === 'yearly') {
      priceId = isTestMode 
        ? (process.env.STRIPE_YEARLY_PRICE_ID_TEST || process.env.STRIPE_VIP_YEARLY_PRICE_ID_TEST || process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_VIP_YEARLY_PRICE_ID)
        : (process.env.STRIPE_YEARLY_PRICE_ID_LIVE || process.env.STRIPE_VIP_YEARLY_PRICE_ID_LIVE || process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_VIP_YEARLY_PRICE_ID);
    } else {
      priceId = isTestMode
        ? (process.env.STRIPE_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_VIP_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_VIP_MONTHLY_PRICE_ID || process.env.STRIPE_MONTHLY_PRICE_ID)
        : (process.env.STRIPE_MONTHLY_PRICE_ID_LIVE || process.env.STRIPE_VIP_MONTHLY_PRICE_ID_LIVE || process.env.STRIPE_VIP_MONTHLY_PRICE_ID || process.env.STRIPE_MONTHLY_PRICE_ID);
    }

    if (!priceId) {
      throw new Error(`Stripe Price ID is not configured for the ${plan} plan (${isTestMode ? 'TEST' : 'LIVE'} mode).`);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard?vip_success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/vip?canceled=true`,
      client_reference_id: parentId,
      metadata: {
        is_vip_subscription: 'true',
        parent_id: parentId
      }
    });

    return NextResponse.redirect(new URL(session.url!, req.url), 303);
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
