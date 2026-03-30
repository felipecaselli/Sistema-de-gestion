-- Actualizar estructura de tabla orders para que tenga todos los campos necesarios

-- 1. Agregar columnas faltantes a tabla orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS object_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS service_details TEXT,
ADD COLUMN IF NOT EXISTS estimated_date DATE,
ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2) DEFAULT 0;

-- El campo customer_name puede quedarse para referencia si es necesario

-- 2. Crear vista para facilitar lectura de datos
-- (Esto es opcional, pero ayuda con compatibilidad)
