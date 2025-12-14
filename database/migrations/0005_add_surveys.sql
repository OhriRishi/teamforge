-- Migration: v2.0.0
-- Description: Add comprehensive Surveys feature with templates, ratings, and visibility controls
-- Created: 2025-01-22
-- Consolidated from: v2.0.0 migrations

-- ==============================================
-- UP SECTION
-- ==============================================

-- =============================================
-- 1. SURVEY TEMPLATES TABLE
-- =============================================

-- Create survey_templates table (must be created before surveys for foreign key)
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  team_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  description TEXT,
  header_image_url TEXT,
  footer_content JSONB, -- Rich text content stored as JSON (BlockNote format)
  footer_html TEXT, -- Pre-rendered HTML for display
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add primary key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_templates_pkey'
  ) THEN
    ALTER TABLE ONLY public.survey_templates
      ADD CONSTRAINT survey_templates_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraints for templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_templates_team_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_templates
      ADD CONSTRAINT survey_templates_team_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_templates_created_by_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_templates
      ADD CONSTRAINT survey_templates_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for templates
CREATE INDEX IF NOT EXISTS idx_survey_templates_team ON public.survey_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_survey_templates_active ON public.survey_templates(is_active);

-- Add comments for templates
COMMENT ON TABLE public.survey_templates IS 'Reusable templates for surveys with custom branding';
COMMENT ON COLUMN public.survey_templates.footer_content IS 'Rich text content in JSON format (BlockNote)';
COMMENT ON COLUMN public.survey_templates.footer_html IS 'Pre-rendered HTML for efficient display';

-- =============================================
-- 2. SURVEYS TABLE
-- =============================================

-- Create surveys table with visibility column
CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  team_id UUID NOT NULL,
  season_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(title) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'team')),
  template_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Add primary key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveys_pkey'
  ) THEN
    ALTER TABLE ONLY public.surveys
      ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraints for surveys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveys_team_fkey'
  ) THEN
    ALTER TABLE ONLY public.surveys
      ADD CONSTRAINT surveys_team_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveys_season_fkey'
  ) THEN
    ALTER TABLE ONLY public.surveys
      ADD CONSTRAINT surveys_season_fkey
      FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveys_created_by_fkey'
  ) THEN
    ALTER TABLE ONLY public.surveys
      ADD CONSTRAINT surveys_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveys_template_fkey'
  ) THEN
    ALTER TABLE ONLY public.surveys
      ADD CONSTRAINT surveys_template_fkey
      FOREIGN KEY (template_id) REFERENCES public.survey_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for surveys
CREATE INDEX IF NOT EXISTS idx_surveys_team_season ON public.surveys(team_id, season_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON public.surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_visibility ON public.surveys(visibility);
CREATE INDEX IF NOT EXISTS idx_surveys_template ON public.surveys(template_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON public.surveys(created_at DESC);

-- Add comments for surveys
COMMENT ON TABLE public.surveys IS 'Survey templates created by teams with title, description, status, and visibility';
COMMENT ON COLUMN public.surveys.status IS 'Survey status: draft (editable), published (accepting responses), closed (no responses)';
COMMENT ON COLUMN public.surveys.visibility IS 'Survey visibility: public (anyone), private (login required), team (team members only)';
COMMENT ON COLUMN public.surveys.template_id IS 'Optional reference to survey template for branding';

-- =============================================
-- 3. SURVEY QUESTIONS TABLE
-- =============================================

-- Create survey_questions table with rating type included
CREATE TABLE IF NOT EXISTS public.survey_questions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  survey_id UUID NOT NULL,
  question_text TEXT NOT NULL CHECK (length(question_text) > 0),
  question_type TEXT NOT NULL CHECK (question_type IN ('short_answer', 'long_answer', 'multiple_choice', 'dropdown', 'checkboxes', 'rating')),
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add primary key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_questions_pkey'
  ) THEN
    ALTER TABLE ONLY public.survey_questions
      ADD CONSTRAINT survey_questions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_questions_survey_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_questions
      ADD CONSTRAINT survey_questions_survey_fkey
      FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON public.survey_questions(survey_id, sort_order);

-- Add comments
COMMENT ON TABLE public.survey_questions IS 'Questions for surveys with different types (text, choice, rating, etc.)';
COMMENT ON COLUMN public.survey_questions.question_type IS 'Type: short_answer, long_answer, multiple_choice, dropdown, checkboxes, rating';
COMMENT ON COLUMN public.survey_questions.options IS 'JSON array of options for choice-based questions';
COMMENT ON COLUMN public.survey_questions.sort_order IS 'Display order of questions in the survey';

-- =============================================
-- 4. SURVEY RESPONSES TABLE
-- =============================================

-- Create survey_responses table
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  survey_id UUID NOT NULL,
  respondent_name TEXT,
  respondent_email TEXT,
  team_member_id UUID,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add primary key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_responses_pkey'
  ) THEN
    ALTER TABLE ONLY public.survey_responses
      ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_responses_survey_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_responses
      ADD CONSTRAINT survey_responses_survey_fkey
      FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_responses_team_member_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_responses
      ADD CONSTRAINT survey_responses_team_member_fkey
      FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_member ON public.survey_responses(team_member_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_submitted_at ON public.survey_responses(submitted_at DESC);

-- Add comments
COMMENT ON TABLE public.survey_responses IS 'Survey submissions from respondents (public or team members)';
COMMENT ON COLUMN public.survey_responses.respondent_name IS 'Optional name for public respondents';
COMMENT ON COLUMN public.survey_responses.respondent_email IS 'Optional email for public respondents';
COMMENT ON COLUMN public.survey_responses.team_member_id IS 'Team member ID if respondent is authenticated (NULL for public)';

-- =============================================
-- 5. SURVEY ANSWERS TABLE
-- =============================================

-- Create survey_answers table
CREATE TABLE IF NOT EXISTS public.survey_answers (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  response_id UUID NOT NULL,
  question_id UUID NOT NULL,
  answer_text TEXT,
  answer_options JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add primary key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_answers_pkey'
  ) THEN
    ALTER TABLE ONLY public.survey_answers
      ADD CONSTRAINT survey_answers_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_answers_response_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_answers
      ADD CONSTRAINT survey_answers_response_fkey
      FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_answers_question_fkey'
  ) THEN
    ALTER TABLE ONLY public.survey_answers
      ADD CONSTRAINT survey_answers_question_fkey
      FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON public.survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON public.survey_answers(question_id);

-- Add comments
COMMENT ON TABLE public.survey_answers IS 'Individual answers to survey questions';
COMMENT ON COLUMN public.survey_answers.answer_text IS 'Text-based answer for text and rating questions';
COMMENT ON COLUMN public.survey_answers.answer_options IS 'JSON array for checkbox multi-select answers';

-- =============================================
-- 6. STORAGE BUCKET FOR TEMPLATE IMAGES
-- =============================================

-- Create storage bucket for survey template images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'survey-templates',
  'survey-templates',
  true, -- Public bucket since images will be displayed on public surveys
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

-- ===== SURVEY TEMPLATES POLICIES =====

-- Team members can view their team's templates
DROP POLICY IF EXISTS "Team members can view their team's templates" ON public.survey_templates;
CREATE POLICY "Team members can view their team's templates"
  ON public.survey_templates
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can create templates
DROP POLICY IF EXISTS "Team members can create templates" ON public.survey_templates;
CREATE POLICY "Team members can create templates"
  ON public.survey_templates
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can update their team's templates
DROP POLICY IF EXISTS "Team members can update their team's templates" ON public.survey_templates;
CREATE POLICY "Team members can update their team's templates"
  ON public.survey_templates
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can delete their team's templates
DROP POLICY IF EXISTS "Team members can delete their team's templates" ON public.survey_templates;
CREATE POLICY "Team members can delete their team's templates"
  ON public.survey_templates
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Anyone can view templates used in published public surveys
DROP POLICY IF EXISTS "Anyone can view templates used in published surveys" ON public.survey_templates;
CREATE POLICY "Anyone can view templates used in published surveys"
  ON public.survey_templates
  FOR SELECT
  USING (
    id IN (
      SELECT template_id FROM public.surveys
      WHERE status = 'published' AND visibility = 'public' AND template_id IS NOT NULL
    )
  );

-- ===== SURVEYS POLICIES (Visibility-based) =====

-- Team members can view ALL their team's surveys (drafts, published, closed)
DROP POLICY IF EXISTS "Team members can view their team's surveys" ON public.surveys;
CREATE POLICY "Team members can view their team's surveys"
  ON public.surveys
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Public surveys can be viewed by anyone
DROP POLICY IF EXISTS "Anyone can view public published surveys" ON public.surveys;
CREATE POLICY "Anyone can view public published surveys"
  ON public.surveys
  FOR SELECT
  USING (status = 'published' AND visibility = 'public');

-- Private surveys require authentication
DROP POLICY IF EXISTS "Authenticated users can view private published surveys" ON public.surveys;
CREATE POLICY "Authenticated users can view private published surveys"
  ON public.surveys
  FOR SELECT
  USING (status = 'published' AND visibility = 'private' AND auth.uid() IS NOT NULL);

-- Team surveys require team membership (already covered by team's surveys policy)
DROP POLICY IF EXISTS "Team members can view team surveys" ON public.surveys;
CREATE POLICY "Team members can view team surveys"
  ON public.surveys
  FOR SELECT
  USING (
    visibility = 'team' AND team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can create surveys
DROP POLICY IF EXISTS "Team members can create surveys for their team" ON public.surveys;
CREATE POLICY "Team members can create surveys for their team"
  ON public.surveys
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can update their team's surveys
DROP POLICY IF EXISTS "Team members can update their team's surveys" ON public.surveys;
CREATE POLICY "Team members can update their team's surveys"
  ON public.surveys
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Team members can delete their team's surveys
DROP POLICY IF EXISTS "Team members can delete their team's surveys" ON public.surveys;
CREATE POLICY "Team members can delete their team's surveys"
  ON public.surveys
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- ===== SURVEY QUESTIONS POLICIES (Visibility-based) =====

-- Team members can view questions for their team's surveys
DROP POLICY IF EXISTS "Team members can view questions for their team's surveys" ON public.survey_questions;
CREATE POLICY "Team members can view questions for their team's surveys"
  ON public.survey_questions
  FOR SELECT
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Public survey questions accessible to anyone
DROP POLICY IF EXISTS "Anyone can view questions for public published surveys" ON public.survey_questions;
CREATE POLICY "Anyone can view questions for public published surveys"
  ON public.survey_questions
  FOR SELECT
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE status = 'published' AND visibility = 'public'
    )
  );

-- Private survey questions require authentication
DROP POLICY IF EXISTS "Authenticated users can view questions for private surveys" ON public.survey_questions;
CREATE POLICY "Authenticated users can view questions for private surveys"
  ON public.survey_questions
  FOR SELECT
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE status = 'published' AND visibility = 'private' AND auth.uid() IS NOT NULL
    )
  );

-- Team survey questions require team membership
DROP POLICY IF EXISTS "Team members can view questions for team surveys" ON public.survey_questions;
CREATE POLICY "Team members can view questions for team surveys"
  ON public.survey_questions
  FOR SELECT
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE visibility = 'team' AND team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Team members can create questions
DROP POLICY IF EXISTS "Team members can create questions for their team's surveys" ON public.survey_questions;
CREATE POLICY "Team members can create questions for their team's surveys"
  ON public.survey_questions
  FOR INSERT
  WITH CHECK (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Team members can update questions
DROP POLICY IF EXISTS "Team members can update questions for their team's surveys" ON public.survey_questions;
CREATE POLICY "Team members can update questions for their team's surveys"
  ON public.survey_questions
  FOR UPDATE
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Team members can delete questions
DROP POLICY IF EXISTS "Team members can delete questions for their team's surveys" ON public.survey_questions;
CREATE POLICY "Team members can delete questions for their team's surveys"
  ON public.survey_questions
  FOR DELETE
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- ===== SURVEY RESPONSES POLICIES (Visibility-based) =====

-- Team members can view responses to their team's surveys
DROP POLICY IF EXISTS "Team members can view responses to their team's surveys" ON public.survey_responses;
CREATE POLICY "Team members can view responses to their team's surveys"
  ON public.survey_responses
  FOR SELECT
  USING (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Anyone can view their own response by ID (for confirmation page)
DROP POLICY IF EXISTS "Anyone can view specific response by ID" ON public.survey_responses;
CREATE POLICY "Anyone can view specific response by ID"
  ON public.survey_responses
  FOR SELECT
  USING (true);

-- Public surveys allow anonymous responses
DROP POLICY IF EXISTS "Anyone can submit responses to public surveys" ON public.survey_responses;
CREATE POLICY "Anyone can submit responses to public surveys"
  ON public.survey_responses
  FOR INSERT
  WITH CHECK (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE status = 'published' AND visibility = 'public'
    )
  );

-- Private surveys require authentication
DROP POLICY IF EXISTS "Authenticated users can submit responses to private surveys" ON public.survey_responses;
CREATE POLICY "Authenticated users can submit responses to private surveys"
  ON public.survey_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND survey_id IN (
      SELECT id FROM public.surveys
      WHERE status = 'published' AND visibility = 'private'
    )
  );

-- Team surveys require team membership
DROP POLICY IF EXISTS "Team members can submit responses to team surveys" ON public.survey_responses;
CREATE POLICY "Team members can submit responses to team surveys"
  ON public.survey_responses
  FOR INSERT
  WITH CHECK (
    survey_id IN (
      SELECT id FROM public.surveys
      WHERE status = 'published' AND visibility = 'team' AND team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- ===== SURVEY ANSWERS POLICIES (Visibility-based) =====

-- Team members can view answers to their team's surveys
DROP POLICY IF EXISTS "Team members can view answers to their team's surveys" ON public.survey_answers;
CREATE POLICY "Team members can view answers to their team's surveys"
  ON public.survey_answers
  FOR SELECT
  USING (
    response_id IN (
      SELECT id FROM public.survey_responses
      WHERE survey_id IN (
        SELECT id FROM public.surveys
        WHERE team_id IN (
          SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Anyone can view answers for a specific response (for confirmation page)
DROP POLICY IF EXISTS "Anyone can view answers for specific response" ON public.survey_answers;
CREATE POLICY "Anyone can view answers for specific response"
  ON public.survey_answers
  FOR SELECT
  USING (true);

-- Public survey answers
DROP POLICY IF EXISTS "Anyone can create answers for public surveys" ON public.survey_answers;
CREATE POLICY "Anyone can create answers for public surveys"
  ON public.survey_answers
  FOR INSERT
  WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.survey_responses r
      JOIN public.surveys s ON r.survey_id = s.id
      WHERE s.status = 'published' AND s.visibility = 'public'
    )
  );

-- Private survey answers
DROP POLICY IF EXISTS "Authenticated users can create answers for private surveys" ON public.survey_answers;
CREATE POLICY "Authenticated users can create answers for private surveys"
  ON public.survey_answers
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND response_id IN (
      SELECT r.id FROM public.survey_responses r
      JOIN public.surveys s ON r.survey_id = s.id
      WHERE s.status = 'published' AND s.visibility = 'private'
    )
  );

-- Team survey answers
DROP POLICY IF EXISTS "Team members can create answers for team surveys" ON public.survey_answers;
CREATE POLICY "Team members can create answers for team surveys"
  ON public.survey_answers
  FOR INSERT
  WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.survey_responses r
      JOIN public.surveys s ON r.survey_id = s.id
      WHERE s.status = 'published' AND s.visibility = 'team'
      AND s.team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- ===== STORAGE POLICIES FOR SURVEY TEMPLATES =====

DROP POLICY IF EXISTS "Team members can upload template images" ON storage.objects;
CREATE POLICY "Team members can upload template images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'survey-templates' AND
    auth.uid() IN (
      SELECT user_id FROM public.team_members
    )
  );

DROP POLICY IF EXISTS "Team members can update their template images" ON storage.objects;
CREATE POLICY "Team members can update their template images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'survey-templates' AND
    auth.uid() IN (
      SELECT user_id FROM public.team_members
    )
  );

DROP POLICY IF EXISTS "Team members can delete their template images" ON storage.objects;
CREATE POLICY "Team members can delete their template images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'survey-templates' AND
    auth.uid() IN (
      SELECT user_id FROM public.team_members
    )
  );

DROP POLICY IF EXISTS "Anyone can view template images" ON storage.objects;
CREATE POLICY "Anyone can view template images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'survey-templates');

-- =============================================
-- 8. HELPER FUNCTIONS
-- =============================================

-- Function to get surveys with question count
CREATE OR REPLACE FUNCTION get_surveys_with_question_count(p_team_id UUID, p_season_id UUID)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  season_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  visibility TEXT,
  template_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  question_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.team_id,
    s.season_id,
    s.title,
    s.description,
    s.status,
    s.visibility,
    s.template_id,
    s.created_by,
    s.created_at,
    s.updated_at,
    s.published_at,
    s.closed_at,
    COUNT(q.id) as question_count
  FROM public.surveys s
  LEFT JOIN public.survey_questions q ON s.id = q.survey_id
  WHERE s.team_id = p_team_id AND s.season_id = p_season_id
  GROUP BY s.id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_surveys_with_question_count(UUID, UUID) IS 'Returns surveys for a team/season with question counts';

-- =============================================
-- 9. RECORD VERSION
-- =============================================

-- =============================================
-- 10. SHEETS SUPPORT (page_type and folder_type)
-- =============================================

-- Add page_type column to notebook_pages to differentiate between notes and sheets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notebook_pages'
    AND column_name = 'page_type'
  ) THEN
    ALTER TABLE public.notebook_pages
    ADD COLUMN page_type TEXT NOT NULL DEFAULT 'note';

    -- Add check constraint
    ALTER TABLE public.notebook_pages
    ADD CONSTRAINT notebook_pages_page_type_check
    CHECK (page_type IN ('note', 'sheet'));

    -- Add index for faster filtering by page type
    CREATE INDEX idx_notebook_pages_page_type ON public.notebook_pages(page_type);

    -- Add comment for documentation
    COMMENT ON COLUMN public.notebook_pages.page_type IS 'Type of page: note (default) or sheet (spreadsheet)';
  END IF;
END $$;

-- Add folder_type column to notebook_folders to differentiate between note and sheet folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notebook_folders'
    AND column_name = 'folder_type'
  ) THEN
    ALTER TABLE public.notebook_folders
    ADD COLUMN folder_type TEXT NOT NULL DEFAULT 'note';

    -- Add check constraint
    ALTER TABLE public.notebook_folders
    ADD CONSTRAINT notebook_folders_folder_type_check
    CHECK (folder_type IN ('note', 'sheet'));

    -- Create index for efficient filtering by folder_type
    CREATE INDEX idx_notebook_folders_folder_type
    ON public.notebook_folders(team_id, season_id, folder_type);

    -- Comment for documentation
    COMMENT ON COLUMN public.notebook_folders.folder_type IS 'Type of folder: note (default) or sheet - keeps folders separate between features';
  END IF;
END $$;

-- =============================================
-- 11. RECORD VERSION
-- =============================================

-- Record this version in schema_versions
INSERT INTO public.schema_versions (version, release_notes_path, description)
VALUES ('2.0.0', '/releases/v2.0.0.md', 'Add Surveys feature and Sheets support')
ON CONFLICT (version) DO NOTHING;

-- ==============================================
-- DOWN SECTION
-- ==============================================

-- DOWN:

-- Remove storage policies
DROP POLICY IF EXISTS "Team members can upload template images" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update their template images" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete their template images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view template images" ON storage.objects;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'survey-templates';

-- Remove helper function
DROP FUNCTION IF EXISTS get_surveys_with_question_count(UUID, UUID);

-- Remove RLS policies for survey_answers
DROP POLICY IF EXISTS "Team members can view answers to their team's surveys" ON public.survey_answers;
DROP POLICY IF EXISTS "Anyone can view answers for specific response" ON public.survey_answers;
DROP POLICY IF EXISTS "Anyone can create answers for public surveys" ON public.survey_answers;
DROP POLICY IF EXISTS "Authenticated users can create answers for private surveys" ON public.survey_answers;
DROP POLICY IF EXISTS "Team members can create answers for team surveys" ON public.survey_answers;

-- Remove RLS policies for survey_responses
DROP POLICY IF EXISTS "Team members can view responses to their team's surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Anyone can view specific response by ID" ON public.survey_responses;
DROP POLICY IF EXISTS "Anyone can submit responses to public surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Authenticated users can submit responses to private surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Team members can submit responses to team surveys" ON public.survey_responses;

-- Remove RLS policies for survey_questions
DROP POLICY IF EXISTS "Team members can view questions for their team's surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Anyone can view questions for public published surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Authenticated users can view questions for private surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Team members can view questions for team surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Team members can create questions for their team's surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Team members can update questions for their team's surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Team members can delete questions for their team's surveys" ON public.survey_questions;

-- Remove RLS policies for surveys
DROP POLICY IF EXISTS "Team members can view their team's surveys" ON public.surveys;
DROP POLICY IF EXISTS "Anyone can view public published surveys" ON public.surveys;
DROP POLICY IF EXISTS "Authenticated users can view private published surveys" ON public.surveys;
DROP POLICY IF EXISTS "Team members can view team surveys" ON public.surveys;
DROP POLICY IF EXISTS "Team members can create surveys for their team" ON public.surveys;
DROP POLICY IF EXISTS "Team members can update their team's surveys" ON public.surveys;
DROP POLICY IF EXISTS "Team members can delete their team's surveys" ON public.surveys;

-- Remove RLS policies for survey_templates
DROP POLICY IF EXISTS "Team members can view their team's templates" ON public.survey_templates;
DROP POLICY IF EXISTS "Team members can create templates" ON public.survey_templates;
DROP POLICY IF EXISTS "Team members can update their team's templates" ON public.survey_templates;
DROP POLICY IF EXISTS "Team members can delete their team's templates" ON public.survey_templates;
DROP POLICY IF EXISTS "Anyone can view templates used in published surveys" ON public.survey_templates;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS public.survey_answers;
DROP TABLE IF EXISTS public.survey_responses;
DROP TABLE IF EXISTS public.survey_questions;
DROP TABLE IF EXISTS public.surveys;
DROP TABLE IF EXISTS public.survey_templates;

-- Remove sheets columns
ALTER TABLE public.notebook_pages DROP CONSTRAINT IF EXISTS notebook_pages_page_type_check;
DROP INDEX IF EXISTS idx_notebook_pages_page_type;
ALTER TABLE public.notebook_pages DROP COLUMN IF EXISTS page_type;

ALTER TABLE public.notebook_folders DROP CONSTRAINT IF EXISTS notebook_folders_folder_type_check;
DROP INDEX IF EXISTS idx_notebook_folders_folder_type;
ALTER TABLE public.notebook_folders DROP COLUMN IF EXISTS folder_type;

-- Remove version record
DELETE FROM public.schema_versions WHERE version = '2.0.0';
