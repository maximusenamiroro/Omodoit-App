-- Adds payout/bank account fields directly to profiles rather than a
-- separate table, since this app only needs one primary bank account
-- per user (the common case for marketplace payouts) — a separate
-- table with its own RLS policies would be unnecessary complexity for
-- a strictly one-to-one relationship. If multiple bank accounts per
-- user is ever needed, that's the point to split this out properly.
--
-- Safe to run any time: all nullable, no default, doesn't touch any
-- existing rows.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_name text;
