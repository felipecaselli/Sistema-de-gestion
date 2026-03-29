-- ============================================
-- Arreglar política RLS para INSERT
-- ============================================

-- Eliminar la política restrictiva de INSERT anterior
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Crear nueva política que permite INSERT propios (sin restricciones en auth_id)
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (true);

-- Actualizar la política de SELECT para que sea más permisiva
DROP POLICY IF EXISTS "Users see own data" ON users;
CREATE POLICY "Users see own data" ON users
    FOR SELECT USING (
        auth_id = auth.uid() OR 
        (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('admin', 'owner')
    );

-- Listo ✅
