-- RLS (Supabase access control only — not part of shared DDL identity)
-- plus optional tombstone GC RPC (same semantics as Express app GC).

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;



CREATE POLICY "Users manage own topics"
  ON public.topics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own cards"
  ON public.cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own devices"
  ON public.sync_devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own sync ops"
  ON public.sync_operations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own learning"
  ON public.user_learning_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own notification settings"
  ON public.user_notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own reminders"
  ON public.notification_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.purge_synced_tombstones()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  ttl_cutoff timestamptz := now() - interval '30 days';
  min_pulled timestamptz;
BEGIN
  SELECT min(last_pulled_at) INTO min_pulled
  FROM public.sync_devices
  WHERE user_id = auth.uid()
    AND last_seen_at > ttl_cutoff;

  DELETE FROM public.sync_devices
  WHERE user_id = auth.uid()
    AND last_seen_at <= ttl_cutoff;

  DELETE FROM public.cards
  WHERE user_id = auth.uid()
    AND deleted_at IS NOT NULL
    AND (deleted_at <= min_pulled OR deleted_at < ttl_cutoff);

  DELETE FROM public.topics
  WHERE user_id = auth.uid()
    AND deleted_at IS NOT NULL
    AND (deleted_at <= min_pulled OR deleted_at < ttl_cutoff);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_synced_tombstones() TO authenticated;
