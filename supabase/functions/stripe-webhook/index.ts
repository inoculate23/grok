import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      try {
        const userId = session.metadata?.userId || session.client_reference_id;

        if (!userId) {
          console.error('No userId found in session metadata or client_reference_id');
          return;
        }

        const { error: purchaseError } = await supabase.from('purchases').insert({
          user_id: userId,
          stripe_session_id: session.id,
          amount: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'completed',
        });

        if (purchaseError) {
          if (purchaseError.code === '23505') {
            console.info(`Purchase already recorded for session: ${session.id}`);
          } else {
            console.error('Error inserting purchase:', purchaseError);
          }
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${session.id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}