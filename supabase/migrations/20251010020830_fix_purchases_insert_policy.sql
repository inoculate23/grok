/*
  # Fix purchases insert policy

  1. Changes
    - Drop the restrictive service role policy
    - Add policy allowing authenticated users to insert their own purchases
    - Ensures users can only insert purchases for themselves
  
  2. Security
    - Users can only insert purchases with their own user_id
    - Prevents users from creating purchases for other users
*/

DROP POLICY IF EXISTS "Service role can insert purchases" ON purchases;

CREATE POLICY "Users can insert own purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);