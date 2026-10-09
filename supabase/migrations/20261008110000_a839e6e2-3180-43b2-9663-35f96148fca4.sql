ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int;
  allowed record;
  v_email text := lower(trim(NEW.email));
  v_phone text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'phone', '')), '');
  v_avatar_url text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'avatar_url', '')), '');
BEGIN
  IF v_email IS NULL OR v_email !~ '^[^@]+@beachpark[.]com[.]br$' THEN
    RAISE EXCEPTION 'Apenas contas @beachpark.com.br podem autenticar.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO total FROM public.user_roles;

  IF total = 0 THEN
    INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      v_phone,
      v_avatar_url
    )
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fpa');
    RETURN NEW;
  END IF;

  SELECT * INTO allowed FROM public.allowed_emails WHERE email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-mail % não autorizado. Solicite ao administrador FP&A.', v_email
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, area_id, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    allowed.area_id,
    v_phone,
    v_avatar_url
  )
  ON CONFLICT (id) DO UPDATE
    SET area_id = EXCLUDED.area_id,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, allowed.role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
