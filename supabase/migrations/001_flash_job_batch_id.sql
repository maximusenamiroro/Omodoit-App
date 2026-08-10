-- Adds a way to group the multiple hire_requests rows created by a
-- single Flash Job submission, so that when one worker accepts, the
-- others can be marked as no longer available instead of silently
-- staying "pending" forever (or worse, letting two workers both
-- accept the same job).
--
-- Safe to run any time: nullable column, no default, doesn't touch
-- any existing rows. Non-flash bookings (the normal "Book Now" flow)
-- will simply have flash_batch_id = NULL, same as they do today.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor).

ALTER TABLE hire_requests
  ADD COLUMN IF NOT EXISTS flash_batch_id uuid;

-- Speeds up the "find sibling requests in this batch" lookup that
-- runs every time a worker accepts a flash job request.
CREATE INDEX IF NOT EXISTS idx_hire_requests_flash_batch_id
  ON hire_requests (flash_batch_id)
  WHERE flash_batch_id IS NOT NULL;
