-- Novo formato de código de projeto: CAP-AAAA-NN-XXX
-- AAAA = ano do ciclo; NN = número do ciclo dentro do ano; XXX = sequência reiniciada por ciclo

ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS cycle_number_in_year int;

-- Backfill: numera ciclos por ano em ordem de criação
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY year ORDER BY created_at, id) AS n
  FROM public.cycles
)
UPDATE public.cycles c SET cycle_number_in_year = r.n
FROM ranked r WHERE r.id = c.id AND c.cycle_number_in_year IS NULL;

-- Trigger: atribui automaticamente o próximo número ao criar um ciclo
CREATE OR REPLACE FUNCTION public.assign_cycle_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cycle_number_in_year IS NULL THEN
    SELECT COALESCE(MAX(cycle_number_in_year), 0) + 1 INTO NEW.cycle_number_in_year
    FROM public.cycles WHERE year = NEW.year;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_cycle_number ON public.cycles;
CREATE TRIGGER trg_assign_cycle_number
BEFORE INSERT ON public.cycles
FOR EACH ROW EXECUTE FUNCTION public.assign_cycle_number();

-- Atualiza RPC de submissão: usa CAP-AAAA-NN-XXX com sequência reiniciada por ciclo
CREATE OR REPLACE FUNCTION public.submit_project_to_cycle(p_project_id uuid, p_cycle_id uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_year int;
  v_cnum int;
  v_seq int;
  v_code text;
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

  SELECT year, COALESCE(cycle_number_in_year, 1)
    INTO v_year, v_cnum
    FROM public.cycles WHERE id = p_cycle_id;
  IF v_year IS NULL THEN RAISE EXCEPTION 'Ciclo inválido'; END IF;

  IF v_project.code IS NULL OR v_project.code = '' THEN
    SELECT COUNT(*) + 1 INTO v_seq
      FROM public.projects
      WHERE cycle_id = p_cycle_id AND code IS NOT NULL;
    v_code := 'CAP-' || v_year::text
              || '-' || LPAD(v_cnum::text, 2, '0')
              || '-' || LPAD(v_seq::text, 3, '0');
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
END;
$$;