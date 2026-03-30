-- Agregar columna 'budget' a tabla orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2) DEFAULT 0;

-- Verificar que la columna se agregó
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'budget';
