-- Interview questions (configurable per team)
CREATE TABLE IF NOT EXISTS interview_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL,
  text        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Interview sessions (one per worker per milestone)
CREATE TABLE IF NOT EXISTS interviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL,
  worker_id     text NOT NULL,
  milestone     text,              -- '1w' | '2w' | '1m' | '2m' | '3m' | '6m' | '9m' | '1y' | '1y3m'
  scheduled_at  timestamptz,       -- planned date/time (for booking, double-book check)
  conducted_at  timestamptz NOT NULL DEFAULT now(),
  conducted_by  text,
  notes         text,
  email_draft   text,
  form_data     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Individual yes/no answers
CREATE TABLE IF NOT EXISTS interview_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id  uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  answer        boolean,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interviews_worker_id_idx ON interviews(team_id, worker_id);
CREATE INDEX IF NOT EXISTS interview_answers_interview_id_idx ON interview_answers(interview_id);
