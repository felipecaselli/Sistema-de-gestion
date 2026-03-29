# 🔐 Guía de Configuración de Autenticación Multi-Usuario

## ¿Qué acaba de cambiar?

Tu sistema ahora tiene:
- ✅ Página de login/registro
- ✅ Autenticación con Supabase Auth
- ✅ Multi-usuario: Cada cliente accede con sus credenciales
- ✅ Admin panel: Tú puedes crear usuarios para tus clientes
- ✅ Row-Level Security: Cada usuario solo ve sus datos
- ✅ Compatible con PWA (web + app móvil)

---

## 📋 Pasos para Configurar

### PASO 1: Ejecutar SQL en Supabase (IMPORTANTE: Paso a paso)

**Opción A: Ejecutar TODO de una vez (si no tienes errores)**

1. Abre tu proyecto en Supabase → **SQL Editor** → **New Query**
2. Abre el archivo `SETUP_DATABASE_SIMPLE.sql` en tu editor
3. Copia TODO el contenido
4. Pégalo en Supabase SQL Editor
5. Click en **Run** (botón azul)
6. Debería completarse sin errores ✅

---

**Opción B: Si tienes errores, ejecuta bloque por bloque**

⚠️ Si ves el error `column "auth_id" does not exist`, sigue esto:

1. Abre `SETUP_DATABASE_SIMPLE.sql`
2. **Copia SOLO el BLOQUE 1** (extensión UUID)
3. Pégalo en Supabase → Click **Run** → Espera a que termine
4. **Copia SOLO el BLOQUE 2** (tabla users)
5. Pégalo en Supabase → Click **Run** → Espera a que termine
6. **Continúa con los bloques 3, 4, 5...** hasta terminar
7. Cada bloque demora 1-2 segundos

---

### PASO 2: Habilitar Email Provider en Supabase

1. En tu proyecto → **Authentication** → **Providers**
2. Verifica que **Email** esté habilitado (toggle verde)
3. Listo ✅

---

### PASO 3: Probar que todo funcione

#### Test 1: Registrarse
```
1. Abre index.html en navegador
2. Haz click en "Registrarse"
3. Completa: email, contraseña, nombre, empresa
4. Click en "Crear Cuenta"
5. Deberías entrar a la app automáticamente ✅
```

#### Test 2: Crear más usuarios (como admin)
```
1. Logea como tu usuario principal
2. Click en tu avatar (arriba derecha)
3. Click en "Crear Usuario"
4. Completa: email, nombre, empresa, contraseña, rol
5. Click en "Crear Usuario"
6. Deberías ver: "✅ Usuario EMAIL creado exitosamente"
7. El usuario nuevo puede loguearse con esas credenciales ✅
```

#### Test 3: Verificar seguridad (RLS)
```
1. Crea Usuario A con email: usuarioA@test.com
2. Crea Usuario B con email: usuarioB@test.com
3. Logea como Usuario A y crea una orden
4. Logea como Usuario B
5. ❌ NO deberías ver la orden de Usuario A
6. Si la ves, hay un problema con RLS
```

---

## 🔒 Seguridad: ¿Por qué signUp() es seguro?

En lugar de usar `auth.admin.createUser()` (que solo funciona en backend), usamos `signUp()` del cliente, que es seguro porque:

1. **Email Confirmation**: El usuario debe confirmar su email antes de acceder
2. **Row-Level Security (RLS)**: Supabase valida que cada usuario solo accede a sus datos
3. **Tokens JWT**: Las sesiones se protegen con tokens encriptados
4. **No requiere backend**: Todo funciona desde el navegador

---

## 🚀 Flujo de Acceso Multi-Usuario

```
┌─────────────────────────────────────────┐
│   TÚ (OWNER/ADMIN)                      │
│ - Accedes con tu email/contraseña       │
│ - Ves panel de "Crear Usuario"          │
│ - Creas usuarios para tus clientes      │
└─────────────────────────────────────────┘
                    │
                    ├─► [USUARIO 1] - Cliente A
                    │   Ver/editar solo sus órdenes
                    │
                    ├─► [USUARIO 2] - Cliente B
                    │   Ver/editar solo sus órdenes
                    │
                    └─► [USUARIO 3] - Cliente C
                        Ver/editar solo sus órdenes
```

---

## 📋 Verificación: ¿Funciona correctamente?

Haz esta prueba para confirmar que todo está bien:

### Test 1: Crear usuario
```
1. Logea con tu cuenta de admin
2. Click en tu avatar → "Crear Usuario"
3. Completa los campos (email, nombre, empresa, contraseña)
4. Deberías ver: "✅ Usuario EMAIL creado exitosamente"
5. El usuario NUEVO puede loguearse en otra ventana con ese email/contraseña
```

### Test 2: Verificar que no ve datos de otros
```
1. Logea como Usuario 1
2. Crea una orden de prueba
3. Logea como Usuario 2 (otro usuario)
4. ❌ NO deberías ver la orden del Usuario 1
5. Si la ves, hay un problema con RLS
```

### Test 3: Verificar RLS en base de datos
```
1. En Supabase → Table Editor
2. Abre tabla "orders"
3. Deberías ver un candado 🔒 (significa que RLS está activo)
4. Los datos están protegidos por políticas de seguridad
```

---

## 📱 Para Vender a Clientes

**Flujo:**
1. El cliente se registra en tu app
2. Reciben confirmación en su email
3. Acceden a la app con sus credenciales
4. ✅ Solo ven sus propias órdenes, clientes, reportes

**ALTERNATIVA: Tú creas su usuario**
1. Tú vas al panel → "Crear Usuario"
2. Completas email, nombre, empresa
3. Le das la contraseña al cliente
4. El cliente se logea y ¡listo!

---

## 🐛 Troubleshooting

### "El usuario no recibe email de confirmación"
- Verifica que el Email Provider está habilitado en Supabase
- Revisa la carpeta de spam
- En desarrollo, Supabase muestra el link de confirmación en la consola

### "No puedo crear usuarios"
- ¿Tu cuenta es admin/owner? Verifica el campo `role` en la tabla `users`
- ¿Está habilitado RLS? (Debería haber un candado 🔒 en las tablas)

### "User already exists"
- El email ya está registrado
- Intenta con otro email o logea si ya tienes cuenta

### "Session expired después de X tiempo"
- Los tokens de Supabase expiran cada 1 hora
- El app renovará automáticamente (está en el código)
- Si sigue pasando, recarga la página

---

## 💡 Próximos Pasos (Opcional)

1. **Recuperación de contraseña**: Agregar botón "¿Olvidaste tu contraseña?"
2. **Cambio de contraseña**: Permitir que usuarios cambien su contraseña
3. **OAuth (Google, GitHub)**: Login rápido sin contraseña
4. **2FA (Two-Factor Auth)**: Autenticación de dos factores
5. **Roles más granulares**: Solo lectura, edición limitada, etc.

---

## ✅ Checklist Final

- [ ] SQL ejecutado en Supabase sin errores
- [ ] Email Provider habilitado en Authentication
- [ ] Puedes registrarte desde la app
- [ ] Puedes loguearte después
- [ ] Como admin, puedes crear usuarios
- [ ] Los usuarios nuevos pueden loguearse
- [ ] Cada usuario solo ve sus datos (RLS funciona)

¡Listo! Tu sistema está **seguro, escalable y listo para vender** 🚀

---

## 🔒 Seguridad: Row-Level Security (RLS)

Las políticas RLS garantizan que:
- Cada usuario **solo ve órdenes de su empresa**
- No puede ver datos de otros clientes
- Aunque acceda directamente a la API, Supabase rechaza las queries no autorizadas

---

## 📱 Instalación en Móvil

### iOS (Safari)
1. Abre la app en Safari
2. Menú (share) → **Add to Home Screen**
3. Nombre: "CMB" (o tu nombre preferido)
4. ✅ Icono aparece en home screen

### Android (Chrome)
1. Abre la app en Chrome
2. Menú (⋮) → **Install app**
3. O: Long-press home screen → **Add widget/Shortcut**
4. ✅ Icono aparece en home screen

---

## 🐛 Troubleshooting

### "Cannot read property 'admin' of undefined"
- El `auth.admin` no existe en el frontend (es un problema común)
- **Solución**: Usar Edge Function (Opción A arriba)

### "User already exists"
- El email ya está registrado en otra cuenta
- Intenta con otro email o usa "Iniciar Sesión" si ya tienes cuenta

### "Session expired"
- Token expirado
- **Solución**: Recarga la página y logea de nuevo
- El token se guarda en `localStorage` y se valida automáticamente

### "No tienes permisos para esto"
- Probablemente es un problema de RLS
- Verifica que la política está bien escrita en Supabase

---

## 💡 Próximos Pasos (Opcional)

1. **Recuperación de contraseña**: Agregar email de reset
2. **Cambio de contraseña**: Permiso para que usuarios cambien su contraseña
3. **Permisos granulares**: Roles más específicos (solo lectura, edición limitada, etc.)
4. **2FA (Two-Factor Auth)**: Autenticación de dos factores con Supabase
5. **OAuth (Google, GitHub)**: Login rápido sin contraseña

---

## ❓ Preguntas?

Si tienes dudas sobre la configuración, mira:
- [Docs Supabase Auth](https://supabase.com/docs/guides/auth)
- [Docs Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

¡Listo! Tu sistema está configurado para multi-usuario. 🚀
