-- ============================================
-- CMB - Sistema de Gestión de Órdenes
-- Configuración de Base de Datos
-- Ejecutar estos comandos en Supabase
-- ============================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla 'users' para información adicional de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    company VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- user, manager, admin, owner
    tenant_id VARCHAR(255), -- Para multi-tenancy
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla 'customers' (ampliada)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    company VARCHAR(255),
    tipo VARCHAR(50), -- personal, empresa, otro
    address VARCHAR(500),
    tags TEXT[], -- Array de tags
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear tabla 'orders' (ampliada)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255),
    description TEXT,
    labor_cost DECIMAL(10, 2),
    materials_cost DECIMAL(10, 2),
    margin_percent INT DEFAULT 30,
    final_cost DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'recibido', 
    -- recibido, cotizado, presupuestado, proceso, materiales, rechazado, listo, entregado
    assigned_user_id UUID REFERENCES users(id),
    deadline DATE,
    photos TEXT[], -- Array de URLs de fotos
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- 5. Crear tabla 'audit_log' para auditoría
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    table_name VARCHAR(100),
    record_id UUID,
    action VARCHAR(20), -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- 6. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON orders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- 7. IMPORTANTE: Row-Level Security (RLS) - Cada usuario solo ve sus datos
-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política para tabla 'users': Cada usuario ve solo su propia data
CREATE POLICY "Users see own data" ON users
    FOR SELECT USING (
        auth_id = auth.uid() OR
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth_id = auth.uid());

-- Política para tabla 'customers': Cada usuario ve solo clientes de su tenant
CREATE POLICY "Users see customers in same tenant" ON customers
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can insert customers in their tenant" ON customers
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can update customers in their tenant" ON customers
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

-- Política para tabla 'orders': Cada usuario ve solo órdenes de su tenant
CREATE POLICY "Users see orders in same tenant" ON orders
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can insert orders in their tenant" ON orders
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

CREATE POLICY "Users can update orders in their tenant" ON orders
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

-- Política para tabla 'audit_log'
CREATE POLICY "Users see audit logs in same tenant" ON audit_log
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())
    );

-- 8. Crear función para actualizar 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a las tablas
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. IMPORTANTE: Habilitar auth.users().admin acceso
-- En Supabase, usar signUp() en el frontend es seguro porque:
-- - Los usuarios deben confirmar email
-- - Las políticas RLS protegen los datos
-- - Cada usuario solo accede a sus datos

-- Tabla opcional para flujo alternativo (si prefieres crear usuarios desde admin panel sin que confirmen email):
-- CREATE TABLE IF NOT EXISTS pending_users (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     email VARCHAR(255),
--     full_name VARCHAR(255),
--     company VARCHAR(255),
--     role VARCHAR(50),
--     tenant_id VARCHAR(255),
--     created_at TIMESTAMP DEFAULT NOW(),
--     created_by UUID
-- );
