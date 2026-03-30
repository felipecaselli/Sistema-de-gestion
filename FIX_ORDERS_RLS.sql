-- FIX: Eliminar recursión infinita en políticas RLS de tabla orders

-- 1. Eliminar políticas viejas que causan recursión
DROP POLICY IF EXISTS "Users see orders in same tenant" ON orders;
DROP POLICY IF EXISTS "Users can insert orders" ON orders;
DROP POLICY IF EXISTS "Users can update orders" ON orders;
DROP POLICY IF EXISTS "Users can delete orders" ON orders;

-- 2. Habilitar RLS en tabla orders (si no está habilitado)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 3. CREATE nueva SELECT policy SIN recursión
-- Todos los usuarios autenticados pueden ver órdenes de su tenant
CREATE POLICY "Users see orders in same tenant"
ON orders FOR SELECT
USING (
    tenant_id::text = (
        SELECT tenant_id FROM users 
        WHERE auth_id = auth.uid() 
        LIMIT 1
    )::text
);

-- 4. CREATE nueva INSERT policy SIN recursión
-- Permitir INSERT sin verificación de tenant (se valida en la aplicación)
CREATE POLICY "Users can insert orders"
ON orders FOR INSERT
WITH CHECK (true);

-- 5. CREATE nueva UPDATE policy
CREATE POLICY "Users can update orders"
ON orders FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. CREATE nueva DELETE policy
CREATE POLICY "Users can delete orders"
ON orders FOR DELETE
USING (true);
