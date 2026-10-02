-- Investimentos com mais precisão: cripto pode ter quantidades enormes (ex.: 25 milhões de SHIB)
-- e preços de frações de centavo (ex.: R$ 0,00008). Antes eram DECIMAL(10,4) e DECIMAL(10,2):
-- a quantidade estourava ("numeric field overflow") e o preço virava R$ 0,00.
-- Pode rodar de novo sem erro (alterar para o mesmo tipo não faz nada).
ALTER TABLE public.investments
  ALTER COLUMN quantity TYPE NUMERIC(24, 8),
  ALTER COLUMN purchase_price TYPE NUMERIC(24, 8),
  ALTER COLUMN current_price TYPE NUMERIC(24, 8);
