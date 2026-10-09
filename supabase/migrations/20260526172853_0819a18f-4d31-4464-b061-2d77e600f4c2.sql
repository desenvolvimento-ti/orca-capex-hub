
-- Idempotent: the enum swaps only run while the old enum labels still exist.
-- On an already-migrated database, re-running the ALTER COLUMN would fail
-- because later migrations add triggers that reference projects.category.

-- 1) project_category swap
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'project_category' AND e.enumlabel = 'expansao'
  ) THEN
    DROP TYPE IF EXISTS public.project_category_v2;
    CREATE TYPE public.project_category_v2 AS ENUM (
      'novos_negocios',
      'infraestrutura_crescimento',
      'manutencao_recorrente',
      'manutencao_ciclica_estrutural',
      'experiencia_cliente',
      'eficiencia_operacional',
      'infraestrutura_colaboradores'
    );

    ALTER TABLE public.projects
      ALTER COLUMN category TYPE public.project_category_v2
      USING (
        CASE category::text
          WHEN 'expansao' THEN 'novos_negocios'
          WHEN 'transformacao' THEN 'infraestrutura_crescimento'
          WHEN 'manutencao_recorrente' THEN 'manutencao_recorrente'
          WHEN 'manutencao_estrutural' THEN 'manutencao_ciclica_estrutural'
          WHEN 'outro' THEN 'eficiencia_operacional'
          ELSE 'eficiencia_operacional'
        END
      )::public.project_category_v2;

    DROP TYPE public.project_category;
    ALTER TYPE public.project_category_v2 RENAME TO project_category;
  ELSE
    DROP TYPE IF EXISTS public.project_category_v2;
  END IF;
END $$;

-- 2) areas.director_id
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS director_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) window_type swap
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'window_type' AND e.enumlabel = 'intake'
  ) THEN
    DROP TYPE IF EXISTS public.window_type_v2;
    CREATE TYPE public.window_type_v2 AS ENUM ('submissao','analise','fechado');

    ALTER TABLE public.windows
      ALTER COLUMN type TYPE public.window_type_v2
      USING (
        CASE type::text
          WHEN 'intake' THEN 'submissao'
          WHEN 'submissao' THEN 'submissao'
          WHEN 'emergencial' THEN 'submissao'
          WHEN 'revisao' THEN 'analise'
          ELSE 'fechado'
        END
      )::public.window_type_v2;

    DROP TYPE public.window_type;
    ALTER TYPE public.window_type_v2 RENAME TO window_type;
  ELSE
    DROP TYPE IF EXISTS public.window_type_v2;
  END IF;
END $$;

ALTER TABLE public.windows
  ADD COLUMN IF NOT EXISTS auto_transition boolean NOT NULL DEFAULT true;

-- 4) RLS — incluir cco/cmo
DROP POLICY IF EXISTS projects_select_owner_or_area_or_admin ON public.projects;
CREATE POLICY projects_select_owner_or_area_or_admin ON public.projects
FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'fpa'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'cco'::app_role)
  OR has_role(auth.uid(), 'cmo'::app_role)
);

DROP POLICY IF EXISTS projects_update_owner_or_fpa_or_cfo_or_ceo ON public.projects;
DROP POLICY IF EXISTS projects_update_owner_or_fpa_or_cfo_or_ceo_or_cco_or_cmo ON public.projects;
CREATE POLICY projects_update_owner_or_fpa_or_cfo_or_ceo_or_cco_or_cmo ON public.projects
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'fpa'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'cco'::app_role)
  OR has_role(auth.uid(), 'cmo'::app_role)
)
WITH CHECK (
  owner_id = auth.uid()
  OR has_role(auth.uid(), 'fpa'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'cco'::app_role)
  OR has_role(auth.uid(), 'cmo'::app_role)
);

DROP POLICY IF EXISTS disb_select_via_project ON public.disbursements;
CREATE POLICY disb_select_via_project ON public.disbursements
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = disbursements.project_id AND (
    p.owner_id = auth.uid()
    OR has_role(auth.uid(), 'fpa'::app_role)
    OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'cco'::app_role)
    OR has_role(auth.uid(), 'cmo'::app_role)
  ))
);

DROP POLICY IF EXISTS docs_select_via_project ON public.project_documents;
CREATE POLICY docs_select_via_project ON public.project_documents
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND (
    p.owner_id = auth.uid()
    OR has_role(auth.uid(), 'fpa'::app_role)
    OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'cco'::app_role)
    OR has_role(auth.uid(), 'cmo'::app_role)
  ))
);

DROP POLICY IF EXISTS history_select_via_project ON public.project_status_history;
CREATE POLICY history_select_via_project ON public.project_status_history
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_status_history.project_id AND (
    p.owner_id = auth.uid()
    OR has_role(auth.uid(), 'fpa'::app_role)
    OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'cco'::app_role)
    OR has_role(auth.uid(), 'cmo'::app_role)
  ))
);

DROP POLICY IF EXISTS comments_select_via_project ON public.project_comments;
CREATE POLICY comments_select_via_project ON public.project_comments
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND (
    p.owner_id = auth.uid()
    OR has_role(auth.uid(), 'fpa'::app_role)
    OR has_role(auth.uid(), 'cfo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'cco'::app_role)
    OR has_role(auth.uid(), 'cmo'::app_role)
  ))
);

DROP POLICY IF EXISTS comments_insert_via_project ON public.project_comments;
CREATE POLICY comments_insert_via_project ON public.project_comments
FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND (
      p.owner_id = auth.uid()
      OR has_role(auth.uid(), 'fpa'::app_role)
      OR has_role(auth.uid(), 'cfo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'cco'::app_role)
      OR has_role(auth.uid(), 'cmo'::app_role)
    )
  )
);

DROP POLICY IF EXISTS profiles_select_self_or_fpa ON public.profiles;
CREATE POLICY profiles_select_self_or_fpa ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'fpa'::app_role)
  OR has_role(auth.uid(), 'cfo'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'cco'::app_role)
  OR has_role(auth.uid(), 'cmo'::app_role)
);

-- 5) Atualizar submit_project_to_cycle: nova janela 'submissao'
CREATE OR REPLACE FUNCTION public.submit_project_to_cycle(p_project_id uuid, p_cycle_id uuid)
RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_project public.projects;
  v_year INT;
  v_code TEXT;
  v_window_count INT;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF v_project.owner_id <> auth.uid() AND NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para submeter este projeto';
  END IF;

  SELECT COUNT(*) INTO v_window_count FROM public.windows
  WHERE cycle_id = p_cycle_id
    AND type = 'submissao'::window_type
    AND is_open = true
    AND (opens_at IS NULL OR opens_at <= now())
    AND (closes_at IS NULL OR closes_at >= now());
  IF v_window_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma janela de Submissão aberta para este ciclo';
  END IF;

  SELECT year INTO v_year FROM public.cycles WHERE id = p_cycle_id;
  IF v_year IS NULL THEN RAISE EXCEPTION 'Ciclo inválido'; END IF;

  IF v_project.code IS NULL OR v_project.code = '' THEN
    v_code := 'CAP-' || v_year::TEXT || '-' || LPAD(nextval('public.project_seq')::TEXT, 3, '0');
  ELSE
    v_code := v_project.code;
  END IF;

  UPDATE public.projects SET
    cycle_id = p_cycle_id,
    code = v_code,
    status = 'submetido_intake',
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, 'no_hub'::project_status, 'submetido_intake'::project_status, auth.uid(),
          CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
          'Submetido ao ciclo');

  RETURN v_project;
END $$;
