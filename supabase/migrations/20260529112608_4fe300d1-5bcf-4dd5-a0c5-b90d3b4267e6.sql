CREATE OR REPLACE FUNCTION public.decisao_diretoria(
  p_project_id uuid,
  p_acao text,
  p_justificativa text
)
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
  v_from project_status;
  v_amount numeric;
BEGIN
  IF p_acao NOT IN ('aprovar','devolver','reprovar') THEN
    RAISE EXCEPTION 'Ação inválida: %', p_acao;
  END IF;
  IF p_acao IN ('devolver','reprovar') AND (p_justificativa IS NULL OR length(trim(p_justificativa)) = 0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória para devolver ou reprovar.';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  v_from := v_project.status;

  -- Determina o cargo real do ator (preferindo CEO sobre demais para o ramo aguardando_ceo)
  SELECT role INTO v_role FROM public.user_roles
   WHERE user_id = auth.uid()
     AND role IN ('ceo','cfo','cco','cmo','fpa')
   ORDER BY CASE role
     WHEN 'ceo' THEN 1
     WHEN 'cfo' THEN 2
     WHEN 'cco' THEN 3
     WHEN 'cmo' THEN 4
     ELSE 5
   END
   LIMIT 1;

  IF v_project.status = 'aguardando_diretor'::project_status THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = v_project.area_id;
    IF v_director IS NULL OR v_director <> auth.uid() THEN
      RAISE EXCEPTION 'Apenas o Diretor responsável pela área pode decidir';
    END IF;

    IF p_acao = 'aprovar' THEN
      v_to := 'aguardando_ceo'::project_status;
      UPDATE public.projects
         SET status = v_to, extraordinary_approval = true, updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    ELSIF p_acao = 'devolver' THEN
      v_to := 'devolvido_revisao'::project_status;
      UPDATE public.projects
         SET status = v_to, updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    ELSE
      v_to := 'reprovado'::project_status;
      UPDATE public.projects
         SET status = v_to, decided_at = now(),
             ceo_decision_justification = p_justificativa,
             updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    END IF;

  ELSIF v_project.status = 'aguardando_ceo'::project_status THEN
    IF NOT has_role(auth.uid(), 'ceo'::app_role) THEN
      RAISE EXCEPTION 'Apenas o CEO pode decidir nesta etapa';
    END IF;

    IF p_acao = 'aprovar' THEN
      v_amount := COALESCE(v_project.confirmed_total, v_project.estimated_total, 0);
      v_to := 'liberado'::project_status;
      UPDATE public.projects
         SET status = v_to,
             ceo_approved_amount = v_amount,
             released_amount = v_amount,
             ceo_decision_justification = COALESCE(NULLIF(trim(p_justificativa),''), ceo_decision_justification),
             decided_at = now(),
             updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    ELSIF p_acao = 'devolver' THEN
      v_to := 'devolvido_revisao'::project_status;
      UPDATE public.projects
         SET status = v_to, updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    ELSE
      v_to := 'reprovado'::project_status;
      UPDATE public.projects
         SET status = v_to,
             decided_at = now(),
             ceo_decision_justification = p_justificativa,
             ceo_approved_amount = 0,
             released_amount = 0,
             updated_at = now()
       WHERE id = p_project_id
       RETURNING * INTO v_project;
    END IF;

  ELSE
    RAISE EXCEPTION 'Projeto não está em etapa de decisão da Diretoria (status atual: %)', v_project.status;
  END IF;

  INSERT INTO public.project_status_history
    (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES
    (p_project_id, v_from, v_to, auth.uid(), v_role, NULLIF(trim(p_justificativa), ''));

  RETURN v_project;
END;
$$;

REVOKE ALL ON FUNCTION public.decisao_diretoria(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decisao_diretoria(uuid, text, text) TO authenticated;