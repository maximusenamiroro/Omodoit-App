-- Creates the reviews table, which turned out to not exist at all
-- (confirmed via a live "relation reviews does not exist" error) —
-- every review read this session was built defensively assuming this
-- table existed, degrading to an empty/zero state when it didn't, so
-- nothing crashed, but reviews could never actually work anywhere:
-- WorkerListScreen, WorkerPublicProfileScreen, WorkerProfileScreen,
-- TrackingScreen (all reads), and LeaveReviewScreen (the write).

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_worker_id ON reviews(worker_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);

-- RLS: reviews are meant to be public (they're social proof for
-- browsing/booking decisions), but only the client who wrote one can
-- ever have created it — client_id must match the authenticated user,
-- so nobody can insert a review pretending to be someone else.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are publicly readable" ON reviews;
CREATE POLICY "Reviews are publicly readable"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = client_id);
