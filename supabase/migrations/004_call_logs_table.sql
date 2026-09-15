-- Records the outcome of every call attempt, so both parties can see
-- a real call history — previously calling left no trace anywhere.

CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('completed', 'declined', 'missed', 'cancelled')),
  duration_seconds int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_callee_id ON call_logs(callee_id);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own call logs" ON call_logs;
CREATE POLICY "Users can view their own call logs"
  ON call_logs FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

DROP POLICY IF EXISTS "Users can insert call logs they are part of" ON call_logs;
CREATE POLICY "Users can insert call logs they are part of"
  ON call_logs FOR INSERT
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);
