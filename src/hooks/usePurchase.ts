import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePurchase(userId: string | undefined, userEmail?: string) {
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHasPurchased(false);
      setLoading(false);
      return;
    }

    const checkPurchase = async () => {
      try {
        const { data, error } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking purchase:', error);
        }

        if (data) {
          setHasPurchased(true);
          return;
        }

        // Fallback: check Stripe orders view for completed orders
        const { data: orders, error: ordersError } = await supabase
          .from('stripe_user_orders')
          .select('order_id, order_status, payment_status')
          .limit(1);

        if (ordersError && ordersError.code !== 'PGRST116') {
          console.error('Error checking stripe_user_orders:', ordersError);
        }

        type Order = { order_status?: string; payment_status?: string };
        const completed = Array.isArray(orders)
          && (orders as Order[]).some((o) => (o.order_status === 'completed') || (o.payment_status === 'paid'));

        setHasPurchased(!!completed);
      } catch (error) {
        console.error('Error checking purchase:', error);
        setHasPurchased(false);
      } finally {
        setLoading(false);
      }
    };

    // Temporary bypass for known purchaser email to unblock access during dev
    if (userEmail === 'craig.ellenwood@gmail.com') {
      setHasPurchased(true);
      setLoading(false);
      return;
    }
    checkPurchase();

  }, [userId, userEmail]);

  return { hasPurchased, loading };
}
