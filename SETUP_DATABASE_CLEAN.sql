-- ============================================
-- CMB - LIMPIAR Y CREAR DESDE CERO
-- ============================================

-- BLOQUE 0: LIMPIAR TODO (Ejecutar primero)
-- ⚠️ ESTO ELIMINARÁ TODAS LAS TABLAS - Asegúrate de hacer backup si tienes datos importantes

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

-- ============================================
-- BLOQUE 1: Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BLOQUE 2: Crear tabla 'users' (SIN restricciones UNIQUE inicialmente)
CREATE TABLE users (
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
CREATE TABLE customers (
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
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    description TEXT,
    labor_cost DECIMAL(10, 2),
    materials_cost DECIMAL(10, 2),
    margin_percent INT DEFAULT 30,
    final_cost DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'recibido',
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    deadline DATE,
    photos TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- BLOQUE 5: Crear tabla 'audit_log'
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    table_name VARCHAR(100),
    record_id UUID,
    action VARCHAR(20),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- BLOQUE 6: Crear índices
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_assigned_user ON orders(assigned_user_id);
CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- BLOQUE 7: Agregar restricciones UNIQUE
ALTER TABLE users ADD CONSTRAINT users_auth_id_unique UNIQUE (auth_id);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- BLOQUE 8: Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- BLOQUE 9: Crear función de actualización
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BLOQUE 10: Crear triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- BLOQUE 11: Política RLS para 'users' - SELECT
CREATE POLICY "Users see own data" ON users
    FOR SELECT USING (auth_id = auth.uid());

-- BLOQUE 12: Política RLS para 'users' - UPDATE
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth_id = auth.uid());

-- BLOQUE 13: Política RLS para 'users' - INSERT
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth_id = auth.uid());

-- BLOQUE 14: Políticas RLS para 'customers'
CREATE POLICY "Users see customers in same tenant" ON customers
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can insert customers" ON customers
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can update customers" ON customers
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can delete customers" ON customers
    FOR DELETE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- BLOQUE 15: Políticas RLS para 'orders'
CREATE POLICY "Users see orders in same tenant" ON orders
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can insert orders" ON orders
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can update orders" ON orders
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can delete orders" ON orders
    FOR DELETE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- BLOQUE 16: Política RLS para 'audit_log'
CREATE POLICY "Users see audit logs in same tenant" ON audit_log
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    );

-- ============================================
-- ✅ LISTO - Base de datos creada correctamente
-- ============================================
