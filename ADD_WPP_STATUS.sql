-- Agregar todas las columnas que el código intenta guardar en orders

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS wpp_status VARCHAR(50) DEFAULT 'pending';

-- Verificar que existen todas las columnas necesarias
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
