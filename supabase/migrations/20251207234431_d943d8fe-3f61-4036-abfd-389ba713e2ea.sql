-- Create allocation targets table
CREATE TABLE public.allocation_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asset_type TEXT NOT NULL,
  target_percentage NUMERIC NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_type)
);

-- Enable Row Level Security
ALTER TABLE public.allocation_targets ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own allocation targets" 
ON public.allocation_targets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own allocation targets" 
ON public.allocation_targets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own allocation targets" 
ON public.allocation_targets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own allocation targets" 
ON public.allocation_targets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_allocation_targets_updated_at
BEFORE UPDATE ON public.allocation_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();