
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('manager','fpa','cfo','ceo');
CREATE TYPE public.project_category AS ENUM ('expansao','transformacao','manutencao_recorrente','manutencao_estrutural','outro');
CREATE TYPE public.priority_level AS ENUM ('alta','media','baixa');
CREATE TYPE public.phase_type AS ENUM ('planejamento','execucao');
CREATE TYPE public.project_status AS ENUM (
  'rascunho',
  'submetido_intake',
  'pre_aprovado',
  'postergado',
  'cancelado',
  'aguardando_submissao',
  'submetido_documentacao',
  'em_revisao_fpa',
  'devolvido_revisao',
  'aguardando_cfo',
  'retornado_backlog',
  'aguardando_ceo',
  'liberado',
  'liberado_parcial',
  'reprovado'
);
CREATE TYPE public.risk_level AS ENUM ('baixo','medio','alto');
CREATE TYPE public.window_type AS ENUM ('intake','submissao','revisao','emergencial');

-- ============== AREAS ==============
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_area()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT area_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============== CYCLES ==============
CREATE TABLE public.cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, name)
);
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

-- ============== WINDOWS ==============
CREATE TABLE public.windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  type window_type NOT NULL,
  area_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.windows ENABLE ROW LEVEL SECURITY;

-- ============== PROJECTS ==============
CREATE SEQUENCE IF NOT EXISTS public.project_seq;
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE RESTRICT,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category project_category NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  justification TEXT NOT NULL DEFAULT '',
  priority priority_level NOT NULL DEFAULT 'media',
  estimated_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  est_start_date DATE,
  est_end_date DATE,
  status project_status NOT NULL DEFAULT 'rascunho',
  -- pre-approval (Stage 1)
  ceo_approved_amount NUMERIC(14,2),
  ceo_decision_justification TEXT,
  -- Stage 2
  confirmed_total NUMERIC(14,2),
  total_planning NUMERIC(14,2),
  total_execution NUMERIC(14,2),
  planning_end_date DATE,
  execution_end_date DATE,
  -- FP&A review
  fpa_risk risk_level,
  -- Final release (Stage 2)
  released_amount NUMERIC(14,2),
  release_justification TEXT,
  parent_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gen_project_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE y INT; n BIGINT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT year INTO y FROM public.cycles WHERE id = NEW.cycle_id;
    n := nextval('public.project_seq');
    NEW.code := 'CAP-' || y::TEXT || '-' || LPAD(n::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gen_project_code BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.gen_project_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== DISBURSEMENTS ==============
CREATE TABLE public.disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase phase_type NOT NULL,
  period DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE(project_id, phase, period)
);
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

-- ============== DOCUMENTS ==============
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- ============== STATUS HISTORY ==============
CREATE TABLE public.project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status project_status,
  to_status project_status NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_role app_role,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

-- ============== RLS POLICIES ==============

-- areas
CREATE POLICY "areas_select_all" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_fpa_all" ON public.areas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'fpa')) WITH CHECK (has_role(auth.uid(),'fpa'));

-- profiles
CREATE POLICY "profiles_select_self_or_fpa" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(),'fpa') OR has_role(auth.uid(),'cfo') OR has_role(auth.uid(),'ceo'));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_fpa_all" ON public.profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'fpa')) WITH CHECK (has_role(auth.uid(),'fpa'));

-- user_roles
CREATE POLICY "user_roles_select_self_or_fpa" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'fpa'));
CREATE POLICY "user_roles_fpa_all" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'fpa')) WITH CHECK (has_role(auth.uid(),'fpa'));

-- cycles
CREATE POLICY "cycles_select_all" ON public.cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles_fpa_all" ON public.cycles FOR ALL TO authenticated
  USING (has_role(auth.uid(),'fpa')) WITH CHECK (has_role(auth.uid(),'fpa'));

-- windows
CREATE POLICY "windows_select_all" ON public.windows FOR SELECT TO authenticated USING (true);
CREATE POLICY "windows_fpa_all" ON public.windows FOR ALL TO authenticated
  USING (has_role(auth.uid(),'fpa')) WITH CHECK (has_role(auth.uid(),'fpa'));

-- projects
CREATE POLICY "projects_select_owner_or_area_or_admin" ON public.projects FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(),'fpa')
  OR has_role(auth.uid(),'cfo')
  OR has_role(auth.uid(),'ceo')
);
CREATE POLICY "projects_insert_manager_own_area" ON public.projects FOR INSERT TO authenticated WITH CHECK (
  owner_id = auth.uid() AND has_role(auth.uid(),'manager') AND area_id = public.current_user_area()
);
CREATE POLICY "projects_update_owner_or_fpa_or_cfo_or_ceo" ON public.projects FOR UPDATE TO authenticated USING (
  owner_id = auth.uid()
  OR has_role(auth.uid(),'fpa')
  OR has_role(auth.uid(),'cfo')
  OR has_role(auth.uid(),'ceo')
) WITH CHECK (
  owner_id = auth.uid()
  OR has_role(auth.uid(),'fpa')
  OR has_role(auth.uid(),'cfo')
  OR has_role(auth.uid(),'ceo')
);
CREATE POLICY "projects_delete_fpa" ON public.projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'fpa'));

-- disbursements
CREATE POLICY "disb_select_via_project" ON public.disbursements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa') OR has_role(auth.uid(),'cfo') OR has_role(auth.uid(),'ceo')
  )));
CREATE POLICY "disb_write_owner_or_fpa" ON public.disbursements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa')
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa')
  )));

-- documents
CREATE POLICY "docs_select_via_project" ON public.project_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa') OR has_role(auth.uid(),'cfo') OR has_role(auth.uid(),'ceo')
  )));
CREATE POLICY "docs_insert_owner_or_fpa" ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
      p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa')
    ))
  );
CREATE POLICY "docs_delete_owner_or_fpa" ON public.project_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa')
  )));

-- status history
CREATE POLICY "history_select_via_project" ON public.project_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.owner_id = auth.uid() OR has_role(auth.uid(),'fpa') OR has_role(auth.uid(),'cfo') OR has_role(auth.uid(),'ceo')
  )));
CREATE POLICY "history_insert_any_authenticated" ON public.project_status_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============== STORAGE BUCKET FOR DOCS ==============
INSERT INTO storage.buckets (id, name, public) VALUES ('project-docs','project-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-docs');
CREATE POLICY "project_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-docs' AND owner = auth.uid());
CREATE POLICY "project_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-docs' AND (owner = auth.uid() OR has_role(auth.uid(),'fpa')));

-- ============== AUTO PROFILE ON SIGNUP ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
