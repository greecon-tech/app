-- People asking Greecon to set them up (the "Request access" form on the sign-in page). Greecon's
-- own data, not a client's: there is no tenant yet, which is the point of the request.
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL,
  email text NOT NULL,
  phone text,
  site_type text NOT NULL CHECK (site_type IN ('hotel', 'farm', 'solar', 'water', 'other')),
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'onboarded', 'declined')),
  note text,
  handled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_requests_status_created_idx ON access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_requests_email_idx ON access_requests (lower(email), created_at DESC);
