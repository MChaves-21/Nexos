-- Create table for price alert settings
CREATE TABLE public.price_alert_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  global_threshold NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Create table for asset-specific alert thresholds
CREATE TABLE public.asset_alert_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  threshold NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, investment_id)
);

-- Enable RLS
ALTER TABLE public.price_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS policies for price_alert_settings
CREATE POLICY "Users can view their own alert settings"
  ON public.price_alert_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alert settings"
  ON public.price_alert_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert settings"
  ON public.price_alert_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert settings"
  ON public.price_alert_settings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for asset_alert_thresholds
CREATE POLICY "Users can view their own asset thresholds"
  ON public.asset_alert_thresholds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own asset thresholds"
  ON public.asset_alert_thresholds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own asset thresholds"
  ON public.asset_alert_thresholds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own asset thresholds"
  ON public.asset_alert_thresholds FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_price_alert_settings_updated_at
  BEFORE UPDATE ON public.price_alert_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_asset_alert_thresholds_updated_at
  BEFORE UPDATE ON public.asset_alert_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();