-- Une as duas versões de handle_new_user:
--   * drizzle 0019: diretoria/área/telefone de allowed_emails e cadastro sem papel
--     para quem não está liberado (segue pelo fluxo de access_requests);
--   * 20261008110000: só aceita contas @beachpark.com.br e grava o avatar do OAuth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  total INT;
  allowed RECORD;
  v_email text := lower(trim(NEW.email));
  v_phone text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'phone', '')), '');
  v_name  text := COALESCE(NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''), NEW.email);
  v_avatar_url text := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'avatar_url', '')), '');
BEGIN
  IF v_email IS NULL OR v_email !~ '^[^@]+@beachpark[.]com[.]br$' THEN
    RAISE EXCEPTION 'Apenas contas @beachpark.com.br podem autenticar.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO total FROM public.user_roles;
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
  VALUES (NEW.id, v_name, NEW.email, v_phone, v_avatar_url)
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);
  IF total = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fpa') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;
  SELECT * INTO allowed FROM public.allowed_emails WHERE email = v_email;
  IF FOUND THEN
    UPDATE public.profiles
       SET area_id = allowed.area_id,
           directorate_id = allowed.directorate_id,
           phone = COALESCE(v_phone, allowed.phone, public.profiles.phone)
     WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, allowed.role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;
