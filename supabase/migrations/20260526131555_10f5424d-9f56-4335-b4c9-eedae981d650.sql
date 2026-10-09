
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total INT;
  allowed RECORD;
  v_email text := lower(trim(NEW.email));
  v_phone text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'phone', '')), '');
BEGIN
  SELECT COUNT(*) INTO total FROM public.user_roles;

  IF total = 0 THEN
    INSERT INTO public.profiles (id, full_name, email, phone)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, v_phone)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fpa');
    RETURN NEW;
  END IF;

  SELECT * INTO allowed FROM public.allowed_emails WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-mail % não autorizado. Solicite ao administrador FP&A.', v_email
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, area_id, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, allowed.area_id, v_phone)
  ON CONFLICT (id) DO UPDATE
    SET area_id = EXCLUDED.area_id,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, allowed.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $function$;

DROP POLICY IF EXISTS projects_insert_manager_own_area ON public.projects;
CREATE POLICY projects_insert_manager_or_fpa
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    (has_role(auth.uid(), 'manager'::app_role) AND area_id = public.current_user_area())
    OR has_role(auth.uid(), 'fpa'::app_role)
  )
);
