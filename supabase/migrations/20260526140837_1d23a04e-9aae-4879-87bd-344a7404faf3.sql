
-- Limpeza de dados de teste
DELETE FROM public.disbursements;
DELETE FROM public.project_documents;
DELETE FROM public.project_status_history;
DELETE FROM public.projects;

-- E2: cycle_id opcional e novo status "no_hub"
ALTER TABLE public.projects ALTER COLUMN cycle_id DROP NOT NULL;
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'no_hub';

-- E3: tag de aprovação extraordinária (CFO)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS extraordinary_approval BOOLEAN NOT NULL DEFAULT false;

-- Atualiza trigger de geração de código para só gerar quando cycle_id existir
CREATE OR REPLACE FUNCTION public.gen_project_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE y INT; n BIGINT;
BEGIN
  IF NEW.cycle_id IS NOT NULL AND (NEW.code IS NULL OR NEW.code = '') THEN
    SELECT year INTO y FROM public.cycles WHERE id = NEW.cycle_id;
    n := nextval('public.project_seq');
    NEW.code := 'CAP-' || y::TEXT || '-' || LPAD(n::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END $function$;

-- Permite código vazio para projetos no hub do gestor
ALTER TABLE public.projects ALTER COLUMN code DROP NOT NULL;

-- Atualiza policy de INSERT para aceitar projetos sem ciclo
DROP POLICY IF EXISTS projects_insert_manager_or_fpa ON public.projects;
CREATE POLICY projects_insert_manager_or_fpa ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  (owner_id = auth.uid())
  AND (
    (has_role(auth.uid(), 'manager'::app_role) AND area_id = current_user_area())
    OR has_role(auth.uid(), 'fpa'::app_role)
  )
);

-- E2: função RPC que valida janela aberta antes de submeter projeto ao ciclo
CREATE OR REPLACE FUNCTION public.submit_project_to_cycle(
  p_project_id UUID,
  p_cycle_id UUID
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- valida janela aberta (requisição = "intake" no banco) ou emergencial
  SELECT COUNT(*) INTO v_window_count FROM public.windows
  WHERE cycle_id = p_cycle_id
    AND type IN ('intake','emergencial')
    AND is_open = true
    AND (opens_at IS NULL OR opens_at <= now())
    AND (closes_at IS NULL OR closes_at >= now());
  IF v_window_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma janela de Requisição aberta para este ciclo';
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

GRANT EXECUTE ON FUNCTION public.submit_project_to_cycle(UUID, UUID) TO authenticated;

-- E4: tabela de comentários por projeto
CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_role public.app_role,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_comments_project ON public.project_comments(project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select_via_project ON public.project_comments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_comments.project_id
    AND (p.owner_id = auth.uid()
      OR has_role(auth.uid(),'fpa'::app_role)
      OR has_role(auth.uid(),'cfo'::app_role)
      OR has_role(auth.uid(),'ceo'::app_role))
));

CREATE POLICY comments_insert_via_project ON public.project_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_comments.project_id
      AND (p.owner_id = auth.uid()
        OR has_role(auth.uid(),'fpa'::app_role)
        OR has_role(auth.uid(),'cfo'::app_role)
        OR has_role(auth.uid(),'ceo'::app_role))
  )
);

CREATE POLICY comments_delete_own ON public.project_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(),'fpa'::app_role));
