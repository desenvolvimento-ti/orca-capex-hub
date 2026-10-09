-- Fix function execute permissions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_area() TO authenticated, anon;

-- Allowed emails table (pre-authorized users)
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role app_role NOT NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_emails_fpa_all" ON public.allowed_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'fpa'))
  WITH CHECK (public.has_role(auth.uid(), 'fpa'));

-- Normalize emails
CREATE OR REPLACE FUNCTION public.normalize_allowed_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.email = lower(trim(NEW.email));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_allowed_emails_normalize ON public.allowed_emails;
CREATE TRIGGER trg_allowed_emails_normalize
  BEFORE INSERT OR UPDATE ON public.allowed_emails
  FOR EACH ROW EXECUTE FUNCTION public.normalize_allowed_email();

-- Replace handle_new_user: first user -> FP&A; others must be in allowed_emails
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
BEGIN
  SELECT COUNT(*) INTO total FROM public.user_roles;

  IF total = 0 THEN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fpa');
    RETURN NEW;
  END IF;

  SELECT * INTO allowed FROM public.allowed_emails WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-mail % não autorizado. Solicite ao administrador FP&A.', v_email
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, area_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, allowed.area_id)
  ON CONFLICT (id) DO UPDATE SET area_id = EXCLUDED.area_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, allowed.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: if a user already exists but has no role, and this is the only user, make them FP&A
DO $$
DECLARE u RECORD; cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.user_roles;
  IF cnt = 0 THEN
    SELECT id, email, raw_user_meta_data FROM auth.users ORDER BY created_at ASC LIMIT 1 INTO u;
    IF u.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'fpa')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;