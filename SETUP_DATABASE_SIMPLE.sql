-- ============================================
-- CMB - Sistema de Gestión de Órdenes
-- Configuración SIMPLE - Ejecutar en bloques
-- ============================================

-- BLOQUE 1: Extensión UUID
-- Ejecutar primero y esperar a que termine
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BLOQUE 2: Crear tabla 'users'
-- Ejecutar segundo
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(255),
    company VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BLOQUE 3: Crear tabla 'customers'
-- Ejecutar tercero
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    company VARCHAR(255),
    tipo VARCHAR(50),
    address VARCHAR(500),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BLOQUE 4: Crear tabla 'orders'
-- Ejecutar cuarto
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
    assigned_user_id UUID REFERENCES users(id),
    deadline DATE,
    photos TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- BLOQUE 5: Crear tabla 'audit_log'
-- Ejecutar quinto
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    table_name VARCHAR(100),
    record_id UUID,
    action VARCHAR(20),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- BLOQUE 6: Crear índices
-- Ejecutar sexto
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_user ON orders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- BLOQUE 6B: Agregar restricciones UNIQUE
-- Ejecutar después del BLOQUE 6
ALTER TABLE users ADD CONSTRAINT users_auth_id_unique UNIQUE (auth_id);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- BLOQUE 7: Habilitar RLS
-- Ejecutar séptimo
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- BLOQUE 8: Crear función de actualización
-- Ejecutar octavo
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BLOQUE 9: Crear triggers
-- Ejecutar noveno
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- BLOQUE 10: Políticas RLS para 'users'
-- Ejecutar décimo - Política 1
CREATE POLICY "Users see own data" ON users
    FOR SELECT USING (auth_id = auth.uid());

-- BLOQUE 11: Política 2 para 'users'
-- Ejecutar onceavo
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth_id = auth.uid());

-- BLOQUE 12: Políticas RLS para 'customers'
-- Ejecutar doceavo
CREATE POLICY "Users see customers in same tenant" ON customers
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can insert customers in their tenant" ON customers
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can update customers in their tenant" ON customers
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- BLOQUE 13: Políticas RLS para 'orders'
-- Ejecutar treceavo
CREATE POLICY "Users see orders in same tenant" ON orders
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can insert orders in their tenant" ON orders
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can update orders in their tenant" ON orders
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- BLOQUE 14: Política RLS para 'audit_log'
-- Ejecutar catorceavo
CREATE POLICY "Users see audit logs in same tenant" ON audit_log
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- ============================================
-- LISTO ✅
-- ============================================
