# 🎯 Cómo Crear Usuarios (Como Admin/Owner)

## ✅ Paso 1: Verifica que eres admin

Cuando te **registraste por primera vez**, automáticamente fuiste configurado como **OWNER** (administrador).

Para verificarlo:
1. **Abre la consola** del navegador (F12)
2. Escribe: `console.log(currentAuthUser)`
3. Deberías ver: `role: "owner"`

Si dice `role: "user"`, no eres admin.

---

## ✅ Paso 2: Abre tu perfil

1. **Busca tu avatar** (arriba a la derecha de la pantalla)
   - Es un círculo azul con tus iniciales (ej: "F" si tu nombre es Félix)
   
2. **Haz click en el avatar**
   - Debería abrirse un modal/ventana con tu perfil
   - Si NO se abre, verifica los pasos 1-2 nuevamente

---

## ✅ Paso 3: Busca el botón "Crear Usuario"

Una vez que se abra el modal de perfil, deberías ver:

```
┌──────────────────────────────────┐
│      Tu Perfil                   │
├──────────────────────────────────┤
│ Avatar                           │
│ Nombre: Felix                    │
│ Email: felix@example.com         │
│ Rol: Propietario                 │
│                                  │
│ Empresa: Mi Taller               │
│                                  │
│ [Cerrar Sesión]  [Crear Usuario] │  ← Aquí está
└──────────────────────────────────┘
```

---

## ✅ Paso 4: Crear un nuevo usuario

1. Click en **"Crear Usuario"**
2. Completa el formulario:
   - **Email**: `cliente@example.com` (email del nuevo usuario)
   - **Nombre**: Nombre completo de la persona
   - **Empresa**: Nombre del taller/empresa del cliente
   - **Contraseña**: Una contraseña temporal (ej: `temporal123`)
   - **Rol**: Déjalo como "Usuario" (por defecto)
3. Click en **"Crear Usuario"**
4. Deberías ver: ✅ **"Usuario EMAIL creado exitosamente"**

---

## ✅ Paso 5: Que el usuario nuevo se logee

El usuario nuevo puede ahora:
1. Ir a la misma página `index.html`
2. Click en **"Iniciar Sesión"**
3. Completa:
   - **Email**: El email que diste
   - **Contraseña**: La contraseña que diste
4. Click en **"Iniciar Sesión"**
5. ✅ Entra a su app

---

## 🔒 Test de Seguridad

Para verificar que cada usuario solo ve sus datos:

1. **Usuario Admin** crea una orden
2. **Logout**: Click en avatar → "Cerrar Sesión"
3. **Usuario Cliente** se logea
4. ❌ NO debería ver la orden del admin
5. ✅ Si no la ve = **seguridad funcionando** 

---

## ⚠️ Si algo no funciona

### "No veo el botón 'Crear Usuario'"
- Probable: No eres admin
- Solución: Abre la consola (F12) y verifica:
  ```javascript
  console.log(currentAuthUser)
  ```
  Si `role` no es "owner", contacta al administrador

### "El avatar no se abre"
- Probable: Hay un error de JavaScript
- Solución: Abre la consola (F12) y busca errores en rojo
- Comparte el error aquí para debuggear

### "El usuario no puede loguearse"
- Verifica que el email y contraseña sean correctos
- El email debe estar exactamente como lo escribiste
- Las contraseñas son sensibles a mayúsculas

---

¿Logras ver el modal del perfil cuando haces click en el avatar? 🎯
