-- Onda A (parte 2) — colunas, migração de dados e funções do novo fluxo

-- Novas colunas em projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS payback_months numeric,
  ADD COLUMN IF NOT EXISTS viability_summary text,
  ADD COLUMN IF NOT EXISTS flag_acompanhamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS directoria_suggested_amount numeric,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

-- Migração de dados: mapeia status legados → novos
UPDATE public.projects SET status = 'em_pre_analise_fpa'::project_status
  WHERE status IN ('submetido_intake'::project_status, 'em_revisao_fpa'::project_status, 'submetido_documentacao'::project_status);

UPDATE public.projects SET status = 'aguardando_diretoria_prev'::project_status
  WHERE status IN ('aguardando_diretor'::project_status, 'aguardando_cfo'::project_status, 'aguardando_ceo'::project_status)
    AND (ceo_approved_amount IS NULL OR ceo_approved_amount = 0);

UPDATE public.projects SET status = 'aguardando_diretoria_final'::project_status
  WHERE status IN ('aguardando_diretor'::project_status, 'aguardando_cfo'::project_status, 'aguardando_ceo'::project_status);

UPDATE public.projects SET status = 'devolvido_pre'::project_status
  WHERE status = 'devolvido_revisao'::project_status
    AND (ceo_approved_amount IS NULL OR ceo_approved_amount = 0);

UPDATE public.projects SET status = 'devolvido_orc'::project_status
  WHERE status = 'devolvido_revisao'::project_status;

UPDATE public.projects SET status = 'em_execucao'::project_status
  WHERE status IN ('liberado'::project_status, 'liberado_parcial'::project_status);

UPDATE public.projects SET status = 'nao_aprovado_pre'::project_status
  WHERE status IN ('postergado'::project_status, 'cancelado'::project_status, 'nao_aprovado'::project_status);

UPDATE public.projects SET status = 'reprovado_final'::project_status
  WHERE status = 'reprovado'::project_status;

UPDATE public.projects SET status = 'no_ciclo'::project_status
  WHERE status IN ('rascunho'::project_status, 'aguardando_submissao'::project_status, 'retornado_backlog'::project_status)
    AND cycle_id IS NOT NULL;

UPDATE public.projects SET status = 'no_hub'::project_status
  WHERE status IN ('rascunho'::project_status, 'aguardando_submissao'::project_status, 'retornado_backlog'::project_status);

-- submit_project_to_cycle sem checagem de janela (ciclos sempre abertos)
CREATE OR REPLACE FUNCTION public.submit_project_to_cycle(p_project_id uuid, p_cycle_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.projects; v_year int; v_cnum int; v_seq int; v_code text; v_from project_status;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.owner_id <> auth.uid() AND NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para submeter este projeto';
  END IF;
  SELECT year, COALESCE(cycle_number_in_year, 1) INTO v_year, v_cnum
    FROM public.cycles WHERE id = p_cycle_id;
  IF v_year IS NULL THEN RAISE EXCEPTION 'Ciclo inválido'; END IF;

  IF v_project.code IS NULL OR v_project.code = '' THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM public.projects
      WHERE cycle_id = p_cycle_id AND code IS NOT NULL;
    v_code := 'CAP-' || v_year::text || '-' || LPAD(v_cnum::text, 2, '0') || '-' || LPAD(v_seq::text, 3, '0');
  ELSE v_code := v_project.code; END IF;

  v_from := v_project.status;
  UPDATE public.projects SET
    cycle_id = p_cycle_id, code = v_code,
    status = 'em_pre_analise_fpa'::project_status,
    submitted_at = COALESCE(submitted_at, now()), updated_at = now()
  WHERE id = p_project_id RETURNING * INTO v_project;

  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_pre_analise_fpa'::project_status, auth.uid(),
          CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
          'Submetido ao ciclo (pré-análise)');
  RETURN v_project;
END; $function$;

-- Decisão de pré-aprovação (Etapa 2)
CREATE OR REPLACE FUNCTION public.decisao_diretoria_prev(
  p_project_id uuid, p_acao text, p_valor_sugerido numeric, p_justificativa text
) RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.projects; v_from project_status; v_to project_status; v_role app_role;
  v_is_fpa boolean; v_director uuid;
BEGIN
  IF p_acao NOT IN ('pre_aprovar','devolver','nao_aprovar') THEN
    RAISE EXCEPTION 'Ação inválida: %', p_acao; END IF;
  IF p_acao IN ('devolver','nao_aprovar') AND (p_justificativa IS NULL OR length(trim(p_justificativa))=0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória.'; END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  v_from := v_project.status;
  IF v_project.status <> 'aguardando_diretoria_prev'::project_status THEN
    RAISE EXCEPTION 'Projeto não está aguardando pré-aprovação (status: %)', v_project.status; END IF;

  v_is_fpa := has_role(auth.uid(),'fpa'::app_role);
  IF NOT v_is_fpa THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = v_project.area_id;
    IF v_director IS NULL OR v_director <> auth.uid() THEN
      RAISE EXCEPTION 'Apenas o Diretor da área (ou FP&A) pode decidir.'; END IF;
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id=auth.uid()
    AND role IN ('ceo','cfo','cco','cmo','fpa')
    ORDER BY CASE role WHEN 'ceo' THEN 1 WHEN 'cfo' THEN 2 WHEN 'cco' THEN 3 WHEN 'cmo' THEN 4 ELSE 5 END LIMIT 1;

  IF p_acao = 'pre_aprovar' THEN
    v_to := 'aguardando_documentacao'::project_status;
    UPDATE public.projects SET status=v_to,
      directoria_suggested_amount = p_valor_sugerido,
      confirmed_total = COALESCE(p_valor_sugerido, confirmed_total, estimated_total),
      updated_at=now() WHERE id=p_project_id RETURNING * INTO v_project;
  ELSIF p_acao = 'devolver' THEN
    v_to := 'devolvido_pre'::project_status;
    UPDATE public.projects SET status=v_to, directoria_suggested_amount=p_valor_sugerido, updated_at=now()
      WHERE id=p_project_id RETURNING * INTO v_project;
  ELSE
    v_to := 'nao_aprovado_pre'::project_status;
    UPDATE public.projects SET status=v_to, decided_at=now(),
      ceo_decision_justification=p_justificativa, updated_at=now()
      WHERE id=p_project_id RETURNING * INTO v_project;
  END IF;

  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, v_from, v_to, auth.uid(), v_role, NULLIF(trim(p_justificativa),''));
  RETURN v_project;
END; $function$;

-- Decisão final (Etapa 3)
CREATE OR REPLACE FUNCTION public.decisao_diretoria_final(
  p_project_id uuid, p_acao text, p_justificativa text
) RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.projects; v_from project_status; v_to project_status; v_role app_role;
  v_is_fpa boolean; v_director uuid; v_amount numeric;
BEGIN
  IF p_acao NOT IN ('aprovar','reprovar') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  IF p_acao='reprovar' AND (p_justificativa IS NULL OR length(trim(p_justificativa))=0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovar.'; END IF;

  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  v_from := v_project.status;
  IF v_project.status <> 'aguardando_diretoria_final'::project_status THEN
    RAISE EXCEPTION 'Projeto não está aguardando aprovação final (status: %)', v_project.status; END IF;

  v_is_fpa := has_role(auth.uid(),'fpa'::app_role);
  IF NOT v_is_fpa THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id=v_project.area_id;
    IF v_director IS NULL OR v_director <> auth.uid() THEN
      RAISE EXCEPTION 'Apenas o Diretor da área (ou FP&A) pode decidir.'; END IF;
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id=auth.uid()
    AND role IN ('ceo','cfo','cco','cmo','fpa')
    ORDER BY CASE role WHEN 'ceo' THEN 1 WHEN 'cfo' THEN 2 WHEN 'cco' THEN 3 WHEN 'cmo' THEN 4 ELSE 5 END LIMIT 1;

  IF p_acao='aprovar' THEN
    v_amount := COALESCE(v_project.confirmed_total, v_project.directoria_suggested_amount, v_project.estimated_total, 0);
    v_to := 'em_execucao'::project_status;
    UPDATE public.projects SET status=v_to,
      ceo_approved_amount=v_amount, released_amount=v_amount, decided_at=now(),
      ceo_decision_justification=COALESCE(NULLIF(trim(p_justificativa),''), ceo_decision_justification),
      updated_at=now() WHERE id=p_project_id RETURNING * INTO v_project;
  ELSE
    v_to := 'reprovado_final'::project_status;
    UPDATE public.projects SET status=v_to, decided_at=now(),
      ceo_decision_justification=p_justificativa,
      ceo_approved_amount=0, released_amount=0, updated_at=now()
      WHERE id=p_project_id RETURNING * INTO v_project;
  END IF;

  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, v_from, v_to, auth.uid(), v_role, NULLIF(trim(p_justificativa),''));
  RETURN v_project;
END; $function$;

-- Gestor responde devolução com valor
CREATE OR REPLACE FUNCTION public.responder_devolucao_pre(
  p_project_id uuid, p_acao text, p_novo_valor numeric, p_comentario text
) RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_project public.projects; v_from project_status; v_to project_status;
BEGIN
  IF p_acao NOT IN ('aceitar','renegociar') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.owner_id<>auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF v_project.status<>'devolvido_pre'::project_status THEN
    RAISE EXCEPTION 'Projeto não está devolvido (status: %)', v_project.status; END IF;
  v_from := v_project.status;

  IF p_acao='aceitar' THEN
    v_to := 'aguardando_documentacao'::project_status;
    UPDATE public.projects SET status=v_to,
      confirmed_total = COALESCE(directoria_suggested_amount, confirmed_total, estimated_total),
      updated_at=now() WHERE id=p_project_id RETURNING * INTO v_project;
  ELSE
    v_to := 'aguardando_diretoria_prev'::project_status;
    UPDATE public.projects SET status=v_to,
      estimated_total = COALESCE(p_novo_valor, estimated_total),
      confirmed_total = COALESCE(p_novo_valor, confirmed_total),
      updated_at=now() WHERE id=p_project_id RETURNING * INTO v_project;
  END IF;

  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, v_from, v_to, auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    NULLIF(trim(p_comentario),''));
  RETURN v_project;
END; $function$;

-- Submeter documentação (Etapa 3)
CREATE OR REPLACE FUNCTION public.submeter_documentacao(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_project public.projects; v_missing int;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.owner_id<>auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF v_project.status<>'aguardando_documentacao'::project_status THEN
    RAISE EXCEPTION 'Projeto não está aguardando documentação (status: %)', v_project.status; END IF;
  SELECT count(*) INTO v_missing FROM public.missing_required_docs(p_project_id, 2);
  IF v_missing>0 THEN RAISE EXCEPTION 'Faltam % documento(s) obrigatório(s).', v_missing; END IF;

  UPDATE public.projects SET status='em_analise_fpa_orc'::project_status, updated_at=now()
    WHERE id=p_project_id RETURNING * INTO v_project;

  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, 'aguardando_documentacao'::project_status, 'em_analise_fpa_orc'::project_status,
    auth.uid(), CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    'Documentação submetida para análise FP&A');
  RETURN v_project;
END; $function$;

-- FP&A encaminha pré-análise → Diretoria (pré)
CREATE OR REPLACE FUNCTION public.encaminhar_para_diretoria_prev(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_project public.projects;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas FP&A pode encaminhar.'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.status<>'em_pre_analise_fpa'::project_status THEN
    RAISE EXCEPTION 'Projeto não está em pré-análise (status: %)', v_project.status; END IF;
  UPDATE public.projects SET status='aguardando_diretoria_prev'::project_status, updated_at=now()
    WHERE id=p_project_id RETURNING * INTO v_project;
  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, 'em_pre_analise_fpa'::project_status, 'aguardando_diretoria_prev'::project_status,
    auth.uid(),'fpa'::app_role,'Encaminhado à Diretoria para pré-aprovação');
  RETURN v_project;
END; $function$;

-- FP&A encaminha orçamentação → Diretoria (final)
CREATE OR REPLACE FUNCTION public.encaminhar_para_diretoria_final(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_project public.projects;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas FP&A pode encaminhar.'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.status<>'em_analise_fpa_orc'::project_status THEN
    RAISE EXCEPTION 'Projeto não está em análise FP&A (status: %)', v_project.status; END IF;
  UPDATE public.projects SET status='aguardando_diretoria_final'::project_status, updated_at=now()
    WHERE id=p_project_id RETURNING * INTO v_project;
  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id, 'em_analise_fpa_orc'::project_status, 'aguardando_diretoria_final'::project_status,
    auth.uid(),'fpa'::app_role,'Encaminhado à Diretoria para aprovação final');
  RETURN v_project;
END; $function$;

-- Gestor conclui projeto
CREATE OR REPLACE FUNCTION public.concluir_projeto(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_project public.projects;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v_project.owner_id<>auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF v_project.status<>'em_execucao'::project_status THEN
    RAISE EXCEPTION 'Projeto não está em execução (status: %)', v_project.status; END IF;
  UPDATE public.projects SET status='concluido'::project_status, concluido_em=now(), updated_at=now()
    WHERE id=p_project_id RETURNING * INTO v_project;
  INSERT INTO public.project_status_history (project_id,from_status,to_status,actor_id,actor_role,comment)
  VALUES (p_project_id,'em_execucao'::project_status,'concluido'::project_status,auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    'Projeto concluído');
  RETURN v_project;
END; $function$;

-- Notificações atualizadas
CREATE OR REPLACE FUNCTION public.notify_project_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_url text; v_code text; v_director uuid;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_code := COALESCE(NEW.code, NEW.name);
  v_url := '/app/projects/' || NEW.id::text;

  IF NEW.status = 'em_pre_analise_fpa'::project_status THEN
    PERFORM public.notify_users(public.fpa_user_ids(),'pre_analise',
      'Novo projeto em pré-análise', v_code, NEW.id, NULL, v_url);
  ELSIF NEW.status = 'aguardando_diretoria_prev'::project_status THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = NEW.area_id;
    IF v_director IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[v_director],'aguardando_diretoria_prev',
        'Projeto aguarda pré-aprovação', v_code, NEW.id, NULL, v_url);
    END IF;
  ELSIF NEW.status = 'aguardando_diretoria_final'::project_status THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = NEW.area_id;
    IF v_director IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[v_director],'aguardando_diretoria_final',
        'Projeto aguarda aprovação final', v_code, NEW.id, NULL, v_url);
    END IF;
  ELSIF NEW.status IN ('devolvido_pre'::project_status,'devolvido_orc'::project_status,'aguardando_documentacao'::project_status) THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id],'aguardando_gestor',
        'Ação necessária no seu projeto', v_code, NEW.id, NULL, v_url);
    END IF;
  ELSIF NEW.status IN ('nao_aprovado_pre'::project_status,'reprovado_final'::project_status) THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id],'nao_aprovado',
        'Projeto não aprovado', v_code, NEW.id, NULL, v_url);
    END IF;
  ELSIF NEW.status = 'em_execucao'::project_status THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id],'em_execucao',
        'Projeto aprovado — pode executar', v_code, NEW.id, NULL, v_url);
    END IF;
  END IF;
  RETURN NEW;
END $function$;