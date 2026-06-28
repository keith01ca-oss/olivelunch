'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientSecret = searchParams.get('client_secret');
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const checkoutMounted = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Stripe) {
      setStripeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!stripeLoaded || !clientSecret || checkoutMounted.current) return;

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Stripe publishable key is not configured');
      return;
    }

    const initStripeCheckout = async () => {
      try {
        const stripe = (window as any).Stripe(publishableKey);
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
        });
        checkout.mount('#checkout');
        checkoutMounted.current = true;
      } catch (err) {
        console.error('Failed to initialize Stripe checkout:', err);
      }
    };

    initStripeCheckout();
  }, [stripeLoaded, clientSecret]);

  if (!clientSecret) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-card border rounded-2xl shadow-sm animate-fade-in-up">
        <h2 className="text-xl font-bold text-red-600 mb-2">Invalid Checkout Session</h2>
        <p className="text-muted-foreground mb-4">No checkout session was found. Please return to the menu and try again.</p>
        <button onClick={() => router.push('/menu')} className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-6 animate-fade-in-up">
      <Script
        src="https://js.stripe.com/v3/"
        onLoad={() => setStripeLoaded(true)}
      />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Secure Checkout</h1>
          <p className="text-sm text-muted-foreground">Complete your order payment securely via Stripe.</p>
        </div>
        <button
          onClick={() => router.push('/menu')}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel & Back
        </button>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm p-4 min-h-[400px] flex flex-col justify-center">
        {!stripeLoaded && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-muted-foreground font-medium">Loading checkout form...</p>
          </div>
        )}
        <div id="checkout" className="w-full"></div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-muted-foreground font-medium animate-pulse">Loading checkout...</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
