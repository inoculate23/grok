/*
  # Create purchases table for Stripe payment tracking

  1. New Tables
    - `purchases`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `stripe_session_id` (text, unique)
      - `amount` (integer, amount in cents)
      - `currency` (text, default 'usd')
      - `status` (text, default 'pending')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `purchases` table
    - Add policy for authenticated users to read their own purchases
    - Add policy for service role to insert purchases (webhook)

  3. Indexes
    - Add index on user_id for fast lookup
    - Add index on stripe_session_id for webhook processing
*/

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE NOT NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert purchases"
  ON purchases
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session_id ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
