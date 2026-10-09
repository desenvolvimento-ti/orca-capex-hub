
CREATE OR REPLACE FUNCTION public.encaminhar_para_diretor(p_project_id uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_director uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Apenas FP&A pode encaminhar ao diretor';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  SELECT director_id INTO v_director FROM public.areas WHERE id = v_project.area_id;
  IF v_director IS NULL THEN
    RAISE EXCEPTION 'Área do projeto não possui Diretor responsável cadastrado. Cadastre em Administração > Áreas.';
  END IF;

  UPDATE public.projects
  SET status = 'aguardando_diretor'::project_status, updated_at = now()
  WHERE id = p_project_id
  RETURNING * INTO v_project;

  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_project.status, 'aguardando_diretor'::project_status, auth.uid(), 'fpa'::app_role,
          'Encaminhado ao Diretor da Área para aprovação extraordinária');

  RETURN v_project;
END $$;

CREATE OR REPLACE FUNCTION public.decisao_diretor(p_project_id uuid, p_aprovado boolean, p_justificativa text)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects;
  v_director uuid;
  v_role app_role;
  v_to project_status;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  SELECT director_id INTO v_director FROM public.areas WHERE id = v_project.area_id;
  IF v_director IS NULL OR v_director <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o Diretor responsável pela área pode decidir';
  END IF;

  IF v_project.status <> 'aguardando_diretor'::project_status THEN
    RAISE EXCEPTION 'Projeto não está aguardando decisão do Diretor';
  END IF;

  IF p_justificativa IS NULL OR length(trim(p_justificativa)) = 0 THEN
    RAISE EXCEPTION 'Informe uma justificativa';
  END IF;

  SELECT role INTO v_role FROM public.user_roles
  WHERE user_id = auth.uid() AND role IN ('cco','cmo','cfo')
  ORDER BY CASE role WHEN 'cco' THEN 1 WHEN 'cmo' THEN 2 ELSE 3 END
  LIMIT 1;

  IF p_aprovado THEN
    v_to := 'submetido_intake'::project_status;
    UPDATE public.projects
    SET status = v_to, extraordinary_approval = true, updated_at = now()
    WHERE id = p_project_id
    RETURNING * INTO v_project;
  ELSE
    v_to := 'reprovado'::project_status;
    UPDATE public.projects
    SET status = v_to, decided_at = now(), ceo_decision_justification = p_justificativa, updated_at = now()
    WHERE id = p_project_id
    RETURNING * INTO v_project;
  END IF;

  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, 'aguardando_diretor'::project_status, v_to, auth.uid(), v_role, p_justificativa);

  RETURN v_project;
END $$;
