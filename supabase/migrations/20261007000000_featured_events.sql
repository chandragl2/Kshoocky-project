CREATE TABLE public.featured_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  media_type text NOT NULL,
  media_url text NOT NULL,
  thumbnail_url text,
  cta_text text,
  cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_events_media_type_check
    CHECK (media_type IN ('image', 'video')),
  CONSTRAINT featured_events_sort_order_check
    CHECK (sort_order >= 0),
  CONSTRAINT featured_events_date_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX featured_events_active_sort_order_idx
  ON public.featured_events (is_active, sort_order);

COMMENT ON TABLE public.featured_events IS
  'Media objects are stored in Supabase Storage. Phase 2 event deletion must remove the event media and thumbnail objects; no automatic Storage deletion is configured. Phase 2 upload UI should validate jpg, jpeg, png, webp, and supported video formats (MP4 preferred) and use the configured project size limit rather than an invented limit.';
COMMENT ON COLUMN public.featured_events.media_url IS
  'Public URL or Storage path following featured-events/{event-id}/media/{filename}; binary media remains in Supabase Storage.';
COMMENT ON COLUMN public.featured_events.thumbnail_url IS
  'Public URL or Storage path following featured-events/{event-id}/thumbnail/{filename}; binary media remains in Supabase Storage.';

ALTER TABLE public.featured_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.featured_events FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.featured_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.featured_events TO anon, authenticated;

CREATE POLICY "Public can read active featured events"
  ON public.featured_events
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= pg_catalog.now())
    AND (ends_at IS NULL OR ends_at >= pg_catalog.now())
  );

CREATE POLICY "Admins can read all featured events"
  ON public.featured_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'featured-events',
  'featured-events',
  true,
  NULL,
  NULL
);

CREATE POLICY "Public can view featured event media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'featured-events');

CREATE POLICY "Admins can upload featured event media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'featured-events'
    AND public.is_admin()
  );

CREATE POLICY "Admins can update featured event media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'featured-events'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'featured-events'
    AND public.is_admin()
  );

CREATE POLICY "Admins can delete featured event media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'featured-events'
    AND public.is_admin()
  );

CREATE FUNCTION public.admin_create_featured_event(
  p_title text,
  p_description text,
  p_media_type text,
  p_media_url text,
  p_thumbnail_url text,
  p_cta_text text,
  p_cta_url text,
  p_sort_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_create_featured_event$
DECLARE
  v_event_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'featured_event_forbidden';
  END IF;

  IF p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_media_type IS NULL OR p_media_type NOT IN ('image', 'video')
    OR p_media_url IS NULL OR pg_catalog.btrim(p_media_url) = ''
    OR p_sort_order IS NULL OR p_sort_order < 0
    OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at < p_starts_at)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'featured_event_invalid';
  END IF;

  INSERT INTO public.featured_events (
    title,
    description,
    media_type,
    media_url,
    thumbnail_url,
    cta_text,
    cta_url,
    sort_order,
    starts_at,
    ends_at
  )
  VALUES (
    p_title,
    p_description,
    p_media_type,
    p_media_url,
    p_thumbnail_url,
    p_cta_text,
    p_cta_url,
    p_sort_order,
    p_starts_at,
    p_ends_at
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$admin_create_featured_event$;

CREATE FUNCTION public.admin_update_featured_event(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_media_type text,
  p_media_url text,
  p_thumbnail_url text,
  p_cta_text text,
  p_cta_url text,
  p_sort_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_featured_event$
DECLARE
  v_event_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'featured_event_forbidden';
  END IF;

  IF p_event_id IS NULL
    OR p_title IS NULL OR pg_catalog.btrim(p_title) = ''
    OR p_media_type IS NULL OR p_media_type NOT IN ('image', 'video')
    OR p_media_url IS NULL OR pg_catalog.btrim(p_media_url) = ''
    OR p_sort_order IS NULL OR p_sort_order < 0
    OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at < p_starts_at)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'featured_event_invalid';
  END IF;

  UPDATE public.featured_events AS event
  SET
    title = p_title,
    description = p_description,
    media_type = p_media_type,
    media_url = p_media_url,
    thumbnail_url = p_thumbnail_url,
    cta_text = p_cta_text,
    cta_url = p_cta_url,
    sort_order = p_sort_order,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    updated_at = pg_catalog.now()
  WHERE event.id = p_event_id
  RETURNING event.id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'featured_event_not_found';
  END IF;

  RETURN v_event_id;
END;
$admin_update_featured_event$;

CREATE FUNCTION public.admin_delete_featured_event(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_delete_featured_event$
DECLARE
  v_event_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'featured_event_forbidden';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'featured_event_id_invalid';
  END IF;

  DELETE FROM public.featured_events AS event
  WHERE event.id = p_event_id
  RETURNING event.id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'featured_event_not_found';
  END IF;

  RETURN v_event_id;
END;
$admin_delete_featured_event$;

CREATE FUNCTION public.admin_update_featured_event_status(
  p_event_id uuid,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $admin_update_featured_event_status$
DECLARE
  v_event_id uuid;
BEGIN
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'featured_event_forbidden';
  END IF;

  IF p_event_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'featured_event_status_invalid';
  END IF;

  UPDATE public.featured_events AS event
  SET
    is_active = p_is_active,
    updated_at = pg_catalog.now()
  WHERE event.id = p_event_id
  RETURNING event.id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'featured_event_not_found';
  END IF;

  RETURN v_event_id;
END;
$admin_update_featured_event_status$;

ALTER FUNCTION public.admin_create_featured_event(text, text, text, text, text, text, text, integer, timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.admin_update_featured_event(uuid, text, text, text, text, text, text, text, integer, timestamptz, timestamptz) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_featured_event(uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_update_featured_event_status(uuid, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_featured_event(text, text, text, text, text, text, text, integer, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_featured_event(text, text, text, text, text, text, text, integer, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.admin_update_featured_event(uuid, text, text, text, text, text, text, text, integer, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_featured_event(uuid, text, text, text, text, text, text, text, integer, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_featured_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_featured_event(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_update_featured_event_status(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_featured_event_status(uuid, boolean) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_create_featured_event(text, text, text, text, text, text, text, integer, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_featured_event(uuid, text, text, text, text, text, text, text, integer, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_featured_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_featured_event_status(uuid, boolean) TO authenticated;
