CREATE OR REPLACE FUNCTION public.fpa_pre_analise(p_project_id uuid, p_acao text, p_comentario text)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.projects; v_to project_status; v_msg text;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o FP&A pode realizar a pré-análise'; END IF;
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.status NOT IN ('em_pre_analise_fpa','aguardando_diretoria_prev') THEN RAISE EXCEPTION 'Projeto não está em análise do FP&A'; END IF;
  IF p_acao = 'devolver' THEN
    IF COALESCE(btrim(p_comentario),'') = '' THEN RAISE EXCEPTION 'Informe o que o gestor precisa ajustar'; END IF;
    v_to := 'devolvido_pre'; v_msg := 'Projeto devolvido para ajuste';
  ELSIF p_acao = 'pre_aprovar' THEN
    v_to := 'em_projeto_firme'; v_msg := 'Projeto pré-aprovado: siga para o planejamento';
  ELSIF p_acao = 'rejeitar' THEN
    IF COALESCE(btrim(p_comentario),'') = '' THEN RAISE EXCEPTION 'Informe o motivo da rejeição'; END IF;
    v_to := 'nao_aprovado_pre'; v_msg := 'Projeto rejeitado';
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  PERFORM set_config('app.rpc','1',true);
  IF v_to = 'em_projeto_firme' THEN
    UPDATE public.projects SET status = v_to, decided_at = now(), prioritization_result = 'aprovado',
      prioritization_published_at = now(),
      firm_study_amount = COALESCE(firm_study_amount, study_amount),
      firm_execution_amount = COALESCE(firm_execution_amount, execution_amount),
      firm_study_start_date = COALESCE(firm_study_start_date, study_start_date),
      firm_execution_start_date = COALESCE(firm_execution_start_date, execution_start_date),
      firm_execution_months = COALESCE(firm_execution_months, execution_months)
    WHERE id = p_project_id RETURNING * INTO v;
    INSERT INTO public.disbursements (project_id, version, phase, period, amount)
    SELECT project_id, 'firme', phase, period, amount FROM public.disbursements
      WHERE project_id = p_project_id AND version = 'indicativo'
    ON CONFLICT (project_id, version, phase, period) DO NOTHING;
  ELSE
    UPDATE public.projects SET status = v_to,
      decided_at = CASE WHEN v_to='nao_aprovado_pre' THEN now() ELSE decided_at END,
      prioritization_justification = CASE WHEN v_to='nao_aprovado_pre' THEN NULLIF(btrim(p_comentario),'') ELSE prioritization_justification END
    WHERE id = p_project_id RETURNING * INTO v;
  END IF;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, (SELECT status FROM public.projects WHERE false), v_to, auth.uid(), 'fpa',
    COALESCE(NULLIF(btrim(p_comentario),''), v_msg));
  RETURN v;
END $function$;