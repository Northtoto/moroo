-- Lesson completions: tracks which lessons each user has finished
CREATE TABLE lesson_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Indexes
CREATE INDEX idx_lesson_completions_user ON lesson_completions(user_id);
CREATE INDEX idx_lesson_completions_course ON lesson_completions(course_id);

-- RLS
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own completions" ON lesson_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON lesson_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own completions" ON lesson_completions FOR DELETE USING (auth.uid() = user_id);

-- Auto-update enrollment progress when a lesson is completed
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_lessons INTEGER;
  done_lessons INTEGER;
  new_progress INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_lessons FROM lessons WHERE course_id = NEW.course_id;
  SELECT COUNT(*) INTO done_lessons FROM lesson_completions
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  IF total_lessons > 0 THEN
    new_progress := ROUND((done_lessons::NUMERIC / total_lessons) * 100);
  ELSE
    new_progress := 0;
  END IF;

  UPDATE enrollments
    SET progress = new_progress
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lesson_completed
  AFTER INSERT ON lesson_completions
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_progress();
