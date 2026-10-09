
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS submission_start timestamptz;
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS submission_end timestamptz;
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS analysis_start timestamptz;
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS analysis_end timestamptz;

CREATE OR REPLACE FUNCTION public.current_cycle_period(p_cycle_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.cycles;
  n timestamptz := now();
BEGIN
  SELECT * INTO c FROM public.cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF c.submission_start IS NOT NULL AND c.submission_end IS NOT NULL
     AND n >= c.submission_start AND n <= c.submission_end THEN
    RETURN 'submissao';
  END IF;

  IF c.analysis_start IS NOT NULL AND c.analysis_end IS NOT NULL
     AND n >= c.analysis_start AND n <= c.analysis_end THEN
    RETURN 'analise';
  END IF;

  RETURN 'fechado';
END $$;

CREATE OR REPLACE FUNCTION public.submit_project_to_cycle(p_project_id uuid, p_cycle_id uuid)
 RETURNS public.projects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_project public.projects;
  v_year INT;
  v_code TEXT;
  v_period text;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF v_project.owner_id <> auth.uid() AND NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para submeter este projeto';
  END IF;

  v_period := public.current_cycle_period(p_cycle_id);
  IF v_period IS DISTINCT FROM 'submissao' THEN
    RAISE EXCEPTION 'Período de Submissão não está aberto para este ciclo';
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
END $function$;
