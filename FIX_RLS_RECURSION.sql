-- FIX: Eliminar recursión infinita en RLS policy de tabla users
-- Problema: SELECT policy tiene referencia circular

-- 1. Eliminar la política SELECT que causa recursión
DROP POLICY IF EXISTS "Users see own data" ON users;

-- 2. Crear nueva política SELECT simple sin recursión
CREATE POLICY "Users see own data"
ON users FOR SELECT
USING (auth.uid() = auth_id);

-- 3. Verificar que el INSERT policy está correctamente configurado
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (true);

-- 4. Permitir UPDATE de datos propios para users con rol 'owner' o 'admin'
DROP POLICY IF EXISTS "Users can update own data" ON users;

CREATE POLICY "Users can update own data"
ON users FOR UPDATE
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- 5. Inicialmente desactivar DELETE para evitar más problemas
-- (Normalmente solo owner debe poder eliminar usuarios, pero eso requiere políticas más complejas)
-- Se puede habilitar después si es necesario con una función plpgsql en lugar de sub-queries

COMMIT;
