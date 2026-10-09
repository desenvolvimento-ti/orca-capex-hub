-- Áreas: aprovação e autoria
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovada';
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS created_by UUID;
UPDATE public.areas SET status = 'aprovada' WHERE status IS NULL;

-- E-mails autorizados: WhatsApp
ALTER TABLE public.allowed_emails ADD COLUMN IF NOT EXISTS phone TEXT;

-- Solicitações de acesso
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  requested_area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  requested_area_name TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own access request select" ON public.access_requests;
CREATE POLICY "own access request select" ON public.access_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'fpa'));

DROP POLICY IF EXISTS "own access request insert" ON public.access_requests;
CREATE POLICY "own access request insert" ON public.access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own access request update" ON public.access_requests;
CREATE POLICY "own access request update" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'fpa'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'fpa'));

DROP TRIGGER IF EXISTS touch_access_requests ON public.access_requests;
CREATE TRIGGER touch_access_requests BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Gestores podem criar áreas pendentes
DROP POLICY IF EXISTS "authenticated can create pending area" ON public.areas;
CREATE POLICY "authenticated can create pending area" ON public.areas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'fpa') OR (status = 'pendente' AND created_by = auth.uid()));

-- Primeiro login não exige pré-autorização
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INT;
  allowed RECORD;
  v_email text := lower(trim(NEW.email));
  v_phone text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'phone', '')), '');
  v_name  text := COALESCE(NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''), NEW.email);
BEGIN
  SELECT COUNT(*) INTO total FROM public.user_roles;

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, v_name, NEW.email, v_phone)
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  IF total = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fpa')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT * INTO allowed FROM public.allowed_emails WHERE email = v_email;
  IF FOUND THEN
    UPDATE public.profiles
       SET area_id = allowed.area_id,
           phone = COALESCE(v_phone, allowed.phone, public.profiles.phone)
     WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, allowed.role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

-- Aprovação de acesso
CREATE OR REPLACE FUNCTION public.approve_access_request(
  p_request_id UUID,
  p_role app_role,
  p_area_id UUID DEFAULT NULL
) RETURNS public.access_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.access_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'fpa') THEN
    RAISE EXCEPTION 'Apenas a Administração pode liberar acessos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.access_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = '22023';
  END IF;

  IF p_role = 'manager' AND p_area_id IS NULL THEN
    RAISE EXCEPTION 'Selecione uma área para o papel Gestor.' USING ERRCODE = '22023';
  END IF;

  IF p_area_id IS NOT NULL THEN
    UPDATE public.areas SET status = 'aprovada' WHERE id = p_area_id AND status <> 'aprovada';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = r.user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, p_role);

  UPDATE public.profiles
     SET area_id = p_area_id,
         phone = COALESCE(r.phone, phone)
   WHERE id = r.user_id;

  INSERT INTO public.allowed_emails (email, role, area_id, phone, created_by)
  VALUES (r.email, p_role, p_area_id, r.phone, auth.uid())
  ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role, area_id = EXCLUDED.area_id, phone = COALESCE(EXCLUDED.phone, public.allowed_emails.phone);

  UPDATE public.access_requests
     SET status = 'aprovado', decided_by = auth.uid(), decided_at = now()
   WHERE id = p_request_id
   RETURNING * INTO r;

  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.reject_access_request(p_request_id UUID)
RETURNS public.access_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.access_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'fpa') THEN
    RAISE EXCEPTION 'Apenas a Administração pode recusar acessos.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.access_requests
     SET status = 'recusado', decided_by = auth.uid(), decided_at = now()
   WHERE id = p_request_id
   RETURNING * INTO r;
  RETURN r;
END $$;
