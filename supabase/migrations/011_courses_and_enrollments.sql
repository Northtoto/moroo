-- ═══════════════════════════════════════════════════════════════
-- Migration 011: Create Courses & Enrollments Tables
-- ═══════════════════════════════════════════════════════════════
-- Adds course management and student enrollment tracking

-- Courses table: structured German language courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  image_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enrollments: tracks which students are enrolled in which courses
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress SMALLINT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, course_id)
);

-- Row Level Security: Users can only see published courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_published_courses"
  ON public.courses
  FOR SELECT
  USING (is_published = TRUE);

-- Row Level Security: Users can only see their own enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_enrollments"
  ON public.enrollments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_enrollments"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_progress"
  ON public.enrollments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_courses_level ON public.courses(level);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);

-- Sample courses for testing
INSERT INTO public.courses (title, description, level, is_published)
VALUES
  ('Anfänger A1', 'Grundlagen der deutschen Sprache', 'A1', TRUE),
  ('Anfänger A2', 'Aufbau auf A1 Grundlagen', 'A2', TRUE),
  ('Mittelstufe B1', 'Konversation und Grammatik', 'B1', TRUE),
  ('Mittelstufe B2', 'Fortgeschrittene Konversation', 'B2', TRUE),
  ('Fortgeschritten C1', 'Akademisches Deutsch', 'C1', TRUE),
  ('Mastery C2', 'Natives Sprachniveau', 'C2', TRUE)
ON CONFLICT DO NOTHING;
