// --- AUTHENTICATION SYSTEM ---

let currentAuthUser = JSON.parse(localStorage.getItem('currentAuthUser') || 'null');

// Toggle between login and signup modes
function toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (mode === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
    } else {
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
    }
    
    // Clear error messages
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-error').textContent = '';
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const loadingDiv = document.getElementById('login-loading');
    
    if (!email || !password) {
        errorDiv.textContent = 'Por favor completa todos los campos';
        errorDiv.style.display = 'block';
        return;
    }
    
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    
    try {
        const { data, error } = await dbClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (data.user) {
            // Guardar sesión
            currentAuthUser = {
                id: data.user.id,
                email: data.user.email,
                token: data.session.access_token
            };
            
            // Obtener información del usuario desde tabla 'users'
            const { data: userData, error: userError } = await dbClient
                .from('users')
                .select('*')
                .eq('auth_id', data.user.id)
                .single();
            
            if (userError) {
                console.error('Error al obtener datos del usuario:', userError);
                console.warn('Continuando con datos mínimos del usuario');
            }
            
            if (userData) {
                currentAuthUser.name = userData.full_name || userData.email.split('@')[0];
                currentAuthUser.company = userData.company;
                currentAuthUser.role = userData.role || 'user';
                currentAuthUser.tenant_id = userData.tenant_id;
                console.log('Usuario cargado correctamente:', currentAuthUser);
            } else {
                console.warn('No se encontró datos de usuario en tabla users');
                // Asignar rol por defecto para permitir al menos acceso básico
                currentAuthUser.role = 'user';
            }
            
            localStorage.setItem('currentAuthUser', JSON.stringify(currentAuthUser));
            localStorage.setItem('authToken', data.session.access_token);
            
            // Ocultar login, mostrar app
            showApp();
            loadingDiv.style.display = 'none';
            
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = `Error: ${error.message || 'No se pudo iniciar sesión'}`;
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
    }
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault();
    
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const company = document.getElementById('signup-company').value.trim();
    const errorDiv = document.getElementById('login-error');
    const loadingDiv = document.getElementById('login-loading');
    
    if (!email || !password || !company) {
        errorDiv.textContent = 'Por favor completa todos los campos';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
        errorDiv.style.display = 'block';
        return;
    }
    
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    
    try {
        const { data, error } = await dbClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (data.user) {
            // Crear entrada en tabla 'users'
            const { error: insertError } = await dbClient
                .from('users')
                .insert([{
                    auth_id: data.user.id,
                    email: email,
                    full_name: company,
                    company: company,
                    role: 'owner',
                    tenant_id: `tenant-${Date.now()}`,
                    created_at: new Date().toISOString()
                }]);
            
            if (insertError) {
                throw new Error('Error al crear el perfil: ' + insertError.message);
            }
            
            // Login automático
            currentAuthUser = {
                id: data.user.id,
                email: email,
                token: data.session?.access_token,
                name: company,
                company: company,
                role: 'owner',
                tenant_id: `tenant-${Date.now()}`
            };
            
            localStorage.setItem('currentAuthUser', JSON.stringify(currentAuthUser));
            if (data.session?.access_token) {
                localStorage.setItem('authToken', data.session.access_token);
            }
            
            errorDiv.textContent = '✅ Cuenta creada exitosamente! Redirigiendo...';
            errorDiv.style.color = '#10B981';
            errorDiv.style.display = 'block';
            
            setTimeout(() => {
                showApp();
                loadingDiv.style.display = 'none';
            }, 1500);
        }
    } catch (error) {
        console.error('Signup error:', error);
        errorDiv.textContent = `Error: ${error.message || 'No se pudo crear la cuenta'}`;
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
    }
}

// Show app (hide login)
function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    // Inicializar datos
    initData();
    
    // Actualizar UI con datos del usuario
    updateUserUI();
}

// Update user UI
function updateUserUI() {
    if (!currentAuthUser) return;
    
    const avatar = document.getElementById('user-avatar');
    const nameDisplay = document.getElementById('user-name-display');
    
    if (avatar && nameDisplay) {
        const initials = (currentAuthUser.name || 'U')
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        
        avatar.textContent = initials;
        nameDisplay.textContent = currentAuthUser.name || 'Usuario';
    }
    
    // Actualizar modal del perfil
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileRole = document.getElementById('profile-role');
    const profileCompany = document.getElementById('profile-company');
    
    if (profileAvatar) {
        const initials = (currentAuthUser.name || 'U')
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        profileAvatar.textContent = initials;
    }
    
    if (profileName) profileName.textContent = currentAuthUser.name || 'Usuario';
    if (profileEmail) profileEmail.textContent = currentAuthUser.email || 'email@example.com';
    if (profileRole) {
        const roleName = currentAuthUser.role === 'owner' ? 'Propietario' : 
                         currentAuthUser.role === 'admin' ? 'Administrador' :
                         currentAuthUser.role === 'manager' ? 'Gerente' : 'Usuario';
        profileRole.textContent = roleName;
    }
    if (profileCompany) profileCompany.textContent = currentAuthUser.company || 'Empresa';
    
    // Mostrar botón de crear usuario si es admin o owner
    const createUserBtn = document.getElementById('create-user-btn');
    if (createUserBtn && (currentAuthUser.role === 'owner' || currentAuthUser.role === 'admin')) {
        createUserBtn.style.display = 'block';
    }
}

// Open login modal (for logout or user change)
function openLoginModal() {
    if (!currentAuthUser) return;
    
    // Actualizar perfil antes de abrir
    updateUserUI();
    
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.classList.add('open');
        console.log('[App] Modal abierto. Rol del usuario:', currentAuthUser.role);
    } else {
        console.error('[App] Modal user-profile-modal no encontrado');
    }
}

// Logout
async function handleLogout() {
    try {
        await dbClient.auth.signOut();
        
        // Limpiar sesión local
        currentAuthUser = null;
        localStorage.removeItem('currentAuthUser');
        localStorage.removeItem('authToken');
        
        // Limpiar datos
        globalOrders = [];
        globalUsers = [];
        globalCustomers = [];
        
        // Mostrar login
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        
        // Resetear forms
        document.getElementById('login-form').reset();
        document.getElementById('signup-form').reset();
        toggleAuthMode('login');
        
        showToast('✅ Sesión cerrada', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

// Check authentication on page load
function checkAuth() {
    if (currentAuthUser && currentAuthUser.id) {
        showApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

// --- ADMIN PANEL: CREATE USERS ---

async function openCreateUserModal() {
    // Verificar si es admin
    if (currentAuthUser.role !== 'owner' && currentAuthUser.role !== 'admin') {
        showToast('No tienes permisos para crear usuarios', 'error');
        return;
    }
    
    const modal = document.getElementById('create-user-modal');
    if (modal) {
        modal.classList.add('open');
    }
}

async function createNewUser(event) {
    event.preventDefault();
    
    const email = document.getElementById('new-user-email').value.trim();
    const fullName = document.getElementById('new-user-name').value.trim();
    const company = document.getElementById('new-user-company').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    
    if (!email || !fullName || !password || !company) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }
    
    try {
        showToast('Creando usuario...', 'info');
        
        // Crear usuario en Auth (esto genera un usuario confirmado)
        const { data: authData, error: authError } = await dbClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    company: company,
                    role: role
                }
            }
        });
        
        if (authError) {
            throw new Error('Error en autenticación: ' + authError.message);
        }
        
        if (!authData.user) {
            throw new Error('No se pudo crear el usuario');
        }
        
        // Crear registro en tabla 'users'
        const { error: insertError } = await dbClient
            .from('users')
            .insert([{
                auth_id: authData.user.id,
                email: email,
                full_name: fullName,
                company: company,
                role: role,
                tenant_id: currentAuthUser.tenant_id,
                created_at: new Date().toISOString(),
                created_by: currentAuthUser.id
            }]);
        
        if (insertError) {
            throw new Error('Error al crear registro: ' + insertError.message);
        }
        
        // Limpiar formulario
        document.getElementById('create-user-form').reset();
        
        // Cerrar modal
        const modal = document.getElementById('create-user-modal');
        if (modal) {
            modal.classList.remove('open');
        }
        
        showToast(`✅ Usuario ${email} creado exitosamente`, 'success');
        
        // Recargar usuarios
        await loadUsers();
        
    } catch (error) {
        console.error('Create user error:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Initialize Lucide Icons
lucide.createIcons();

// --- Configuration & Initialization ---
const supabaseUrl = 'https://rpvxndvoekhmzavpbgik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdnhuZHZvZWtobXphdnBiZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDc0NjcsImV4cCI6MjA5MDEyMzQ2N30.AjG_Ng-xPXgGfoVQL5G5a1Y-Zdcjtn8yagV29RBy910';
// Evitar conflicto con la variable global 'supabase' de Supabase CDN:
const dbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const DEFAULT_TENANT_ID = 'taller-demo';
const orderStatuses = ['recibido', 'presupuestado', 'proceso', 'materiales', 'listo', 'entregado'];

const statusConfig = {
    recibido: { label: "Recibido", class: "status-received" },
    presupuestado: { label: "Presupuestado", class: "status-budgeted" },
    proceso: { label: "En Proceso", class: "status-process" },
    materiales: { label: "Espera Mat.", class: "status-materials" },
    listo: { label: "Listo p/ Entrega", class: "status-ready" },
    entregado: { label: "Entregado", class: "status-delivered" }
};

let globalOrders = [];
let globalUsers = [];
let globalCustomers = [];
let appNotifications = [];
let currentUser = localStorage.getItem('currentUser') || '';
let currentUserId = localStorage.getItem('currentUserId') || null;
let notifiedDeadlines = new Set();

// --- Agenda State ---
let currentAgendaDate = new Date();

// --- Chart Instances ---
let statusChartInstance = null;
let revenueChartInstance = null;
let topClientsChartInstance = null;

// --- Load Users ---
async function loadUsers() {
    try {
        const { data, error } = await dbClient
            .from('users')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID);

        if (!error && data) {
            globalUsers = data;
        }
    } catch (err) {
        console.error("Error loading users:", err);
    }
}

// --- Load Customers ---
async function loadCustomers() {
    try {
        const { data, error } = await dbClient
            .from('customers')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID);

        if (!error && data) {
            globalCustomers = data;
        }
    } catch (err) {
        console.error("Error loading customers:", err);
    }
}

// --- Audit Log Function ---
async function logAudit(tableName, recordId, action, oldValues, newValues) {
    try {
        await dbClient
            .from('audit_log')
            .insert([{
                tenant_id: DEFAULT_TENANT_ID,
                table_name: tableName,
                record_id: recordId,
                action: action,
                changed_by: currentUserId || null,
                old_values: oldValues || null,
                new_values: newValues || null
            }]);
    } catch (err) {
        console.error("Error logging audit:", err);
    }
}

async function initData() {
    try {
        // Cargar usuarios
        await loadUsers();
        
        // Cargar clientes
        await loadCustomers();
        
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .order('created_at', { ascending: false });

        if (!error && data) {
            globalOrders = data.map(o => {
                const assignedUser = globalUsers.find(u => u.id === o.assigned_user_id);
                const customer = globalCustomers.find(c => c.id === o.customer_id);
                
                return {
                    id: `OT-${o.id.toString().substring(0,8)}`,
                    dbId: o.id,
                    client: o.client_name,
                    contact: o.contact_phone,
                    email: o.email || '',
                    object: o.object_name,
                    service: o.service_details,
                    budget: o.budget || 0,
                    date: o.estimated_date || o.created_at.split('T')[0],
                    createdAt: o.created_at,
                    status: o.status,
                    wppStatus: o.wpp_status,
                    assignedUserId: o.assigned_user_id,
                    assignedUser: assignedUser ? assignedUser.name : 'Sin asignar',
                    customerId: o.customer_id,
                    customerData: customer
                };
            });
        }
    } catch (err) {
        console.error("SDK Error:", err);
    }
    updateAllViews();
}

// Auto-Polling Realtime App Sync via Supabase
async function pollData() {
    try {
        // Cargar usuarios y clientes
        await loadUsers();
        await loadCustomers();
        
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const newOrders = data.map(o => {
                const assignedUser = globalUsers.find(u => u.id === o.assigned_user_id);
                const customer = globalCustomers.find(c => c.id === o.customer_id);
                
                return {
                    id: `OT-${o.id.toString().substring(0,8)}`,
                    dbId: o.id,
                    client: o.client_name,
                    contact: o.contact_phone,
                    email: o.email || '',
                    object: o.object_name,
                    service: o.service_details,
                    budget: o.budget || 0,
                    date: o.estimated_date || o.created_at.split('T')[0],
                    createdAt: o.created_at,
                    status: o.status,
                    wppStatus: o.wpp_status,
                    assignedUserId: o.assigned_user_id,
                    assignedUser: assignedUser ? assignedUser.name : 'Sin asignar',
                    customerId: o.customer_id,
                    customerData: customer
                };
            });
            
            // Si hay alguna modificación respecto a lo que tenemos en pantalla, re-renderizamos
            if (JSON.stringify(globalOrders) !== JSON.stringify(newOrders)) {
                
                // Disparar Notificación Visual si entró un Nuevo Trabajo (ya sea del bot o manual en otra PC)
                if (globalOrders.length > 0 && newOrders.length > globalOrders.length) {
                    showToast("¡Nuevo cliente o trabajo registrado!");
                    const currDbIds = new Set(globalOrders.map(o => o.dbId));
                    const added = newOrders.filter(o => !currDbIds.has(o.dbId));
                    added.forEach(newOrd => {
                        appNotifications.push({
                            title: `Nuevo Cliente: ${newOrd.client}`,
                            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        });
                    });
                    if(typeof updateNotificationsUI === 'function') updateNotificationsUI();
                }

                globalOrders = newOrders;
                updateAllViews();
                console.log("✅ Datos nuevos detectados vía Supabase. Pantalla actualizada automáticamente.");
            }
        }
    } catch (err) {}
}

function clearData() {
    alert("Los datos ahora están en la nube (PostgreSQL/Supabase) y no pueden ser borrados con botón local.");
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (!document.getElementById('toast-style-anim')) {
        const style = document.createElement('style');
        style.id = 'toast-style-anim';
        style.innerHTML = `
            @keyframes slideInUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes slideOutFade { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    
    // Colores según tipo
    const colorMap = {
        success: { bg: '#10B981', icon: 'check-circle' },
        error: { bg: '#EF4444', icon: 'alert-circle' },
        warning: { bg: '#F59E0B', icon: 'alert-triangle' },
        info: { bg: '#3B82F6', icon: 'info' }
    };
    
    const colors = colorMap[type] || colorMap.success;
    
    toast.style.background = colors.bg;
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.fontWeight = '500';
    toast.style.fontSize = '0.95rem';
    toast.style.animation = 'slideInUp 0.3s ease-out forwards';
    toast.innerHTML = `<i data-lucide="${colors.icon}" style="width:20px;height:20px;"></i> ${message}`;
    
    container.appendChild(toast);
    lucide.createIcons();

    // Notificación nativa desactivada para evitar prompts molestos en archivo local (file://)

    // Auto-destrucción visual del globo flotante
    setTimeout(() => {
        toast.style.animation = 'slideOutFade 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400);
    }, 6000); // Se va a los 6 segundos
}

// Permiso preventivo de notificaciones removido para uso local sin servidor web

// --- PWA & OFFLINE FUNCTIONS ---

// Estado de conectividad
let isOnline = navigator.onLine;

// Guardar en cola offline (para requests POST/PUT que fallaron)
function queueOfflineRequest(method, url, body) {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push({
        method,
        url,
        body,
        timestamp: Date.now()
    });
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    console.log('[App] Request queued for offline sync:', url);
}

// Obtener datos del localStorage (fallback si offline)
function getCachedOrders() {
    const cached = localStorage.getItem('cachedOrders');
    return cached ? JSON.parse(cached) : null;
}

// Guardar órdenes en localStorage para acceso offline
function cacheOrders() {
    localStorage.setItem('cachedOrders', JSON.stringify(globalOrders));
    localStorage.setItem('cacheTimestamp', Date.now());
}

// Actualizar UI según estado online/offline
function updateOnlineStatus() {
    const statusIndicator = document.querySelector('[data-online-status]');
    if (!statusIndicator && isOnline) {
        // No mostrar indicador si está online
        return;
    }
    
    if (!isOnline) {
        // Mostrar algún indicador de offline (ej: borde rojo en header)
        document.body.style.borderTopWidth = '3px';
        document.body.style.borderTopColor = '#EF4444';
        console.log('[App] UI Updated: Now showing offline mode');
    } else {
        document.body.style.borderTopWidth = '0px';
    }
}

// Detectar cambios online/offline
window.addEventListener('online', () => {
    isOnline = true;
    updateOnlineStatus();
    console.log('[App] Connected to internet');
    showToast('📡 Conexión restaurada');
    
    // Intentar sincronizar requests pendientes
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length > 0) {
        showToast(`Sincronizando ${queue.length} cambios pendientes...`);
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SYNC_OFFLINE_REQUESTS'
            });
        }
        
        // Registrar sync tag para background sync
        if (navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.sync) {
                    registration.sync.register('sync-offline-requests').catch((err) => {
                        console.log('[App] Background Sync API not available:', err.message);
                    });
                }
            });
        }
    }
});

// Listen for SYNC_COMPLETE messages from Service Worker
navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, synced, failed, remaining } = event.data;
    
    if (type === 'SYNC_COMPLETE') {
        console.log(`[App] Sync completed: ${synced} synced, ${failed} failed, ${remaining} remaining`);
        
        if (synced > 0) {
            showToast(`✅ ${synced} cambio${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`);
            // Recargar órdenes si algo se sincronizó exitosamente
            setTimeout(() => pollData(), 500);
        }
        
        if (failed > 0) {
            showToast(`⚠️ ${failed} cambio${failed > 1 ? 's' : ''} no se pudo sincronizar. Reintentando...`, 'warning');
        }
    }
    
    if (type === 'REQUEST_QUEUED') {
        console.log('[App] Request queued for offline sync:', event.data.url);
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateOnlineStatus();
    console.log('[App] Lost internet connection');
    showToast('📡 Sin conexión - modo offline');
    cacheOrders(); // Guardar datos en caché
});

// Inicializar estado online
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación primero
    checkAuth();
    
    updateOnlineStatus();
    
    // Instalar prompt para PWA (cuando esté disponible)
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[App] beforeinstallprompt event fired, app is installable');
        
        // Mostrar botón "Instalar app" si se desea
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) {
            installBtn.style.display = 'block';
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('[App] User response:', outcome);
                    deferredPrompt = null;
                }
            });
        }
    });
    
    // Detectar app instalada
    window.addEventListener('appinstalled', () => {
        console.log('[App] PWA was installed successfully');
        showToast('✅ App instalada correctamente');
    });
});

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page-container');
const modalOverlay = document.getElementById('order-modal');

// Filters
const filterText = document.getElementById('filter-text');
const filterStatus = document.getElementById('filter-status');
const globalSearch = document.getElementById('global-search');

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        pages.forEach(page => page.classList.remove('active'));
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(`${targetId}-page`).classList.add('active');
    });
});

function goToOrders() {
    document.querySelector('[data-target="orders"]').click();
}

let isSidebarCollapsed = false;
function toggleSidebar() {
    isSidebarCollapsed = !isSidebarCollapsed;
    document.body.classList.toggle('sidebar-collapsed', isSidebarCollapsed);

    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) {
        if (isSidebarCollapsed) {
            icon.setAttribute('data-lucide', 'chevrons-right');
        } else {
            icon.setAttribute('data-lucide', 'chevrons-left');
        }
        lucide.createIcons();
    }
}

// --- Modal Handlers ---
// --- Populate User Select in Forms ---
function populateUserSelect() {
    const userSelect = document.getElementById('form-assigned-user');
    if (!userSelect) return;
    
    // Clear existing options except the first one
    const firstOption = userSelect.options[0];
    userSelect.innerHTML = '';
    userSelect.appendChild(firstOption);
    
    // Add users
    globalUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.role})`;
        userSelect.appendChild(option);
    });
}

function openOrderModal() {
    document.getElementById('new-order-form').reset();
    document.getElementById('form-date').valueAsDate = new Date();
    populateUserSelect();
    modalOverlay.classList.add('open');
}

function closeOrderModal() {
    modalOverlay.classList.remove('open');
}

// --- Complete Order Modal (Cost Calculation) ---
let pendingCompleteOrderId = null;

function loadCompleteCostSettings() {
    const savedRate = Number(localStorage.getItem('hourlyRate') || 0);
    document.getElementById('complete-hourly-rate').value = savedRate || '';
}

function saveCompleteCostSettings() {
    const rate = Number(document.getElementById('complete-hourly-rate').value) || 0;
    localStorage.setItem('hourlyRate', rate);
    calculateCompleteCost();
}

function calculateCompleteCost() {
    const rate = Number(document.getElementById('complete-hourly-rate').value) || 0;
    const hours = Number(document.getElementById('complete-labor-hours').value) || 0;
    const material = Number(document.getElementById('complete-material-cost').value) || 0;
    const budget = Number(document.getElementById('complete-budget').value) || 0;

    const laborCost = rate * hours;
    const totalCost = laborCost + material;
    const margin = budget - totalCost;
    const marginPct = budget > 0 ? (margin / budget) * 100 : 0;

    const targetEl = document.getElementById('complete-cost-text');
    if (!targetEl) return;

    targetEl.innerHTML = `Costo mano de obra: $${laborCost.toFixed(2)}<br>
        Costo insumos: $${material.toFixed(2)}<br>
        Costo total estimado: $${totalCost.toFixed(2)}<br>
        <strong>Margen proyectado: $${margin.toFixed(2)} (${marginPct.toFixed(1)}%)</strong>`;

    if (margin < 0) {
        targetEl.innerHTML += '<br><span style="color:#b45309;">⚠️ Cuidado: estás debajo del costo.</span>';
    }
}

function openCompleteOrderModal(orderId) {
    pendingCompleteOrderId = orderId;
    document.getElementById('complete-order-form').reset();
    
    const order = globalOrders.find(o => o.id === orderId);
    if (order) {
        document.getElementById('complete-budget').value = Number(order.budget || 0).toFixed(2);
    }
    
    loadCompleteCostSettings();
    calculateCompleteCost();
    document.getElementById('complete-order-modal').classList.add('open');
}

function closeCompleteOrderModal() {
    document.getElementById('complete-order-modal').classList.remove('open');
    pendingCompleteOrderId = null;
}

async function submitCompleteOrder() {
    const form = document.getElementById('complete-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-complete-submit').click();
        return;
    }

    if (!pendingCompleteOrderId) return;

    const rate = Number(document.getElementById('complete-hourly-rate').value) || 0;
    const hours = Number(document.getElementById('complete-labor-hours').value) || 0;
    const material = Number(document.getElementById('complete-material-cost').value) || 0;

    const order = globalOrders.find(o => o.id === pendingCompleteOrderId);
    if (!order) return;

    const laborCost = rate * hours;
    const totalCost = laborCost + material;
    const budget = Number(order.budget || 0);
    const margin = budget - totalCost;
    const marginPct = budget > 0 ? (margin / budget) * 100 : 0;

    const costText = `\n\n- Costo hora: $${rate.toFixed(2)}\n- Horas trabajadas: ${hours.toFixed(2)}\n- Costo mano de obra: $${laborCost.toFixed(2)}\n- Costo insumos: $${material.toFixed(2)}\n- Costo total: $${totalCost.toFixed(2)}\n- Margen: $${margin.toFixed(2)} (${marginPct.toFixed(1)}%)`;

    const baseServiceDetails = order.service || '';
    const finalServiceDetails = `${baseServiceDetails}${costText}`;

    try {
        const oldStatus = order.status;
        const oldService = order.service;
        
        await dbClient
            .from('orders')
            .update({
                status: 'listo',
                service_details: finalServiceDetails
            })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

        // Log audit
        await logAudit('orders', order.dbId, 'UPDATE', 
            { status: oldStatus, service_details: oldService }, 
            { status: 'listo', service_details: finalServiceDetails }
        );

        await initData();
        closeCompleteOrderModal();
        showToast("Orden finalizada y marcada como Listo p/ Entrega");
    } catch (e) {
        console.error("Error al completar orden", e);
        alert("Error al guardar los costos.");
    }
}

// --- Edit Order Modal ---
let pendingEditOrderId = null;

function openEditOrderModal(orderId) {
    pendingEditOrderId = orderId;
    const order = globalOrders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('edit-order-id-display').textContent = order.id;
    document.getElementById('edit-form-client').value = order.client;
    document.getElementById('edit-form-phone').value = order.contact;
    document.getElementById('edit-form-email').value = order.email || '';
    document.getElementById('edit-form-object').value = order.object;
    
    // Extraer solo la descripción base (sin escandallo)
    let serviceText = order.service || '';
    if (serviceText.includes('---\nEscandallo')) {
        serviceText = serviceText.split('---\nEscandallo')[0];
    }
    document.getElementById('edit-form-service').value = serviceText;
    document.getElementById('edit-form-budget').value = Number(order.budget || 0).toFixed(2);
    document.getElementById('edit-form-date').value = order.date;

    document.getElementById('edit-order-modal').classList.add('open');
}

function closeEditOrderModal() {
    document.getElementById('edit-order-modal').classList.remove('open');
    pendingEditOrderId = null;
}

async function submitEditOrder() {
    const form = document.getElementById('edit-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-edit-submit').click();
        return;
    }

    if (!pendingEditOrderId) return;

    const order = globalOrders.find(o => o.id === pendingEditOrderId);
    if (!order) return;

    const updateData = {
        client_name: document.getElementById('edit-form-client').value,
        contact_phone: document.getElementById('edit-form-phone').value,
        email: document.getElementById('edit-form-email').value,
        object_name: document.getElementById('edit-form-object').value,
        service_details: document.getElementById('edit-form-service').value,
        budget: document.getElementById('edit-form-budget').value,
        estimated_date: document.getElementById('edit-form-date').value
    };

    try {
        const oldData = {
            client_name: order.client,
            contact_phone: order.contact,
            email: order.email,
            object_name: order.object,
            service_details: order.service,
            budget: order.budget,
            estimated_date: order.date
        };

        await dbClient
            .from('orders')
            .update(updateData)
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

        // Log audit
        await logAudit('orders', order.dbId, 'UPDATE', oldData, updateData);

        await initData();
        closeEditOrderModal();
        showToast("Orden actualizada correctamente");
    } catch (e) {
        console.error("Error al editar orden", e);
        alert("Error al guardar los cambios.");
    }
}

// --- View Order Modal (Costs & Details) ---
let pendingViewOrderId = null;

function openViewOrderModal(orderId) {
    pendingViewOrderId = orderId;
    const order = globalOrders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('view-order-id-display').textContent = order.id;
    document.getElementById('view-client-name').textContent = order.client;
    document.getElementById('view-object-name').textContent = order.object;
    document.getElementById('view-budget').textContent = Number(order.budget || 0).toLocaleString('es-AR');
    document.getElementById('view-status').textContent = statusConfig[order.status]?.label || order.status;
    document.getElementById('view-date').textContent = order.formattedDate || order.date;

    // Extraer solo la descripción base (sin escandallo)
    let serviceText = order.service || '';
    if (serviceText.includes('---\nEscandallo')) {
        serviceText = serviceText.split('---\nEscandallo')[0];
    }
    document.getElementById('view-service-desc').textContent = serviceText;

    // Extraer proyección de costo si existe (sin separadores ni título)
    let costText = '';
    if (order.service) {
        if (order.service.includes('---\nEscandallo')) {
            costText = order.service.split('---\nEscandallo')[1];
        } else if (order.service.includes('- Costo hora:')) {
            // Para casos actuales con formato embebido sin marcador
            costText = order.service.split('- Costo hora:').slice(1).join('- Costo hora:');
            costText = `- Costo hora:${costText}`;
        }
    }

    costText = (costText || 'Sin cálculo de costo aún.').trim();
    costText = costText.replace(/^Final:\s*/i, '');

    const cleanLines = costText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && line !== '---' && line.toLowerCase() !== 'escandallo');

    const viewCostTextEl = document.getElementById('view-cost-text');
    if (!viewCostTextEl) return;

    if (cleanLines.length === 0) {
        viewCostTextEl.textContent = 'Sin cálculo de costo aún.';
    } else {
        const renderedLines = [];
        let warningNeeded = false;

        cleanLines.forEach(line => {
            let cleanLine = line;
            if (cleanLine.startsWith('- ')) {
                cleanLine = cleanLine.substring(2);
            }

            if (/^margen\s*:/i.test(cleanLine)) {
                const valueMatch = cleanLine.match(/([-+]?[0-9]*\.?[0-9]+)/);
                if (valueMatch && parseFloat(valueMatch[1]) < 0) {
                    warningNeeded = true;
                }
                cleanLine = `<strong>${cleanLine}</strong>`;
            }

            renderedLines.push(cleanLine);
        });

        viewCostTextEl.innerHTML = renderedLines.join('<br>');

        if (warningNeeded) {
            viewCostTextEl.innerHTML += '<br><span style="color:#b45309; font-weight: 600;">⚠️ Cuidado: estás debajo del costo.</span>';
        }
    }

    document.getElementById('view-edit-budget').value = Number(order.budget || 0).toFixed(2);

    document.getElementById('view-order-modal').classList.add('open');
    
    // Cargar historial del cliente
    loadOrderHistory();
}

function closeViewOrderModal() {
    document.getElementById('view-order-modal').classList.remove('open');
    pendingViewOrderId = null;
}

function loadOrderHistory() {
    if (!pendingViewOrderId) return;

    const order = globalOrders.find(o => o.id === pendingViewOrderId);
    if (!order || !order.customerId) {
        const historyEl = document.getElementById('view-customer-history');
        historyEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Sin historial de cliente.</p>';
        return;
    }

    // Obtener todas las órdenes del mismo cliente
    const customerOrders = globalOrders.filter(o => o.customerId === order.customerId);
    
    if (!customerOrders || customerOrders.length === 0) {
        const historyEl = document.getElementById('view-customer-history');
        historyEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Sin órdenes anteriores.</p>';
        return;
    }

    const historyEl = document.getElementById('view-customer-history');
    let historyHtml = '';

    customerOrders.forEach(o => {
        const statusLabel = statusConfig[o.status]?.label || o.status;
        const isCurrentOrder = o.id === order.id;
        const style = isCurrentOrder ? 'background-color: var(--primary-light); font-weight: 600;' : '';
        
        historyHtml += `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer; ${style}" title="${isCurrentOrder ? 'Orden actual' : 'Haz clic para ver detalles'}">
                <strong>${o.id}</strong> - ${o.object}
                <br><small style="color: var(--text-secondary);">${o.date} • ${statusLabel} • $${Number(o.budget).toLocaleString('es-AR')}</small>
            </div>
        `;
    });

    historyEl.innerHTML = historyHtml;
}

async function updateOrderBudget() {
    if (!pendingViewOrderId) return;

    const order = globalOrders.find(o => o.id === pendingViewOrderId);
    if (!order) return;

    const newBudget = Number(document.getElementById('view-edit-budget').value) || 0;
    const oldBudget = order.budget;

    try {
        await dbClient
            .from('orders')
            .update({ budget: newBudget })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

        // Log audit
        await logAudit('orders', order.dbId, 'UPDATE', { budget: oldBudget }, { budget: newBudget });

        await initData();
        closeViewOrderModal();
        showToast("Presupuesto actualizado correctamente");
    } catch (e) {
        console.error("Error al actualizar presupuesto", e);
        alert("Error al guardar el presupuesto.");
    }
}


async function submitOrder() {
    const form = document.getElementById('new-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-submit').click();
        return;
    }

    const baseServiceDetails = document.getElementById('form-service').value;
    const finalServiceDetails = `[Añadido por: ${currentUser || 'Desconocido'}]\n${baseServiceDetails}`;
    
    const clientName = document.getElementById('form-client').value;
    const clientEmail = document.getElementById('form-email').value;
    const empresa = document.getElementById('form-empresa')?.value || null;
    const tipo = document.getElementById('form-cliente-tipo')?.value || 'regular';
    const direccion = document.getElementById('form-direccion')?.value || null;
    const tagsInput = document.getElementById('form-tags')?.value || '';
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    const assignedUserId = document.getElementById('form-assigned-user')?.value || null;

    try {
        // Crear o buscar cliente
        let customerId = null;
        
        // Buscar si el cliente ya existe
        const existingCustomer = globalCustomers.find(c => 
            c.email === clientEmail || (clientEmail === '' && c.name === clientName)
        );
        
        if (existingCustomer) {
            customerId = existingCustomer.id;
        } else {
            // Crear nuevo cliente
            const { data: newCustomer, error: customerError } = await dbClient
                .from('customers')
                .insert([{
                    tenant_id: DEFAULT_TENANT_ID,
                    name: clientName,
                    phone: document.getElementById('form-phone').value,
                    email: clientEmail || null,
                    empresa: empresa,
                    tipo: tipo,
                    direccion: direccion,
                    tags: tags
                }])
                .select();

            if (!customerError && newCustomer) {
                customerId = newCustomer[0].id;
                // Log audit para nuevo cliente
                await logAudit('customers', customerId, 'INSERT', null, newCustomer[0]);
            }
        }

        const payload = {
            tenant_id: DEFAULT_TENANT_ID,
            client_name: clientName,
            contact_phone: document.getElementById('form-phone').value,
            email: clientEmail,
            object_name: document.getElementById('form-object').value,
            service_details: finalServiceDetails,
            budget: document.getElementById('form-budget').value,
            estimated_date: document.getElementById('form-date').value,
            status: "recibido",
            wpp_status: "pending",
            assigned_user_id: assignedUserId,
            customer_id: customerId
        };

        const { data, error } = await dbClient
            .from('orders')
            .insert([payload])
            .select();

        if (!error && data) {
            const newOrderId = data[0].id;
            // Log audit
            await logAudit('orders', newOrderId, 'INSERT', null, payload);
            
            await initData(); // Refrescar los datos desde Supabase
            closeOrderModal();
            showToast("Orden creada correctamente");
        } else {
            alert("Error de Supabase al guardar la orden: " + error.message);
        }
    } catch (e) {
        console.error(e);
        alert("Error de red al guardar la orden.");
    }
}

// Close modals when clicking outside
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeOrderModal();
});

const editModalOverlay = document.getElementById('edit-order-modal');
if (editModalOverlay) {
    editModalOverlay.addEventListener('click', (e) => {
        if (e.target === editModalOverlay) closeEditOrderModal();
    });
}

const viewModalOverlay = document.getElementById('view-order-modal');
if (viewModalOverlay) {
    viewModalOverlay.addEventListener('click', (e) => {
        if (e.target === viewModalOverlay) closeViewOrderModal();
    });
}

const completeModalOverlay = document.getElementById('complete-order-modal');
if (completeModalOverlay) {
    completeModalOverlay.addEventListener('click', (e) => {
        if (e.target === completeModalOverlay) closeCompleteOrderModal();
    });
}

const auditModalOverlay = document.getElementById('audit-modal');
if (auditModalOverlay) {
    auditModalOverlay.addEventListener('click', (e) => {
        if (e.target === auditModalOverlay) closeAuditModal();
    });
}

// --- Audit UI ---
async function openAuditModal() {
    const modal = document.getElementById('audit-modal');
    if (!modal) return;
    
    modal.classList.add('open');
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando auditoría...</td></tr>';
    
    try {
        const { data, error } = await dbClient
            .from('audit_log')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay registros de auditoría aún.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(log => {
            const dateStr = new Date(log.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            
            // Buscar nombre de usuario
            let userName = log.changed_by;
            if (globalUsers && globalUsers.length > 0) {
                const u = globalUsers.find(user => user.id === log.changed_by);
                if (u) userName = u.name || u.email;
            }
            if (!userName) userName = "Sistema / Bot";

            // Formatear acción
            let actionText = log.action === 'INSERT' ? 'Creación' : log.action === 'UPDATE' ? 'Actualización' : 'Eliminación';
            let actionColor = log.action === 'INSERT' ? 'var(--secondary-color)' : log.action === 'UPDATE' ? 'var(--primary-color)' : 'var(--danger-color)';
            
            // Detalles de cambios
            let detailsHtml = `<strong>ID Ref:</strong> ${log.record_id || '-'}`;
            if (log.action === 'UPDATE' && log.new_values) {
                const changes = [];
                for (const key in log.new_values) {
                    const oldVal = (log.old_values && log.old_values[key] !== undefined) ? log.old_values[key] : '-';
                    const newVal = log.new_values[key];
                    if (oldVal !== newVal && key !== 'updated_at') {
                        // Truncar textos muy largos
                        let sOld = String(oldVal);
                        let sNew = String(newVal);
                        if(sOld.length > 40) sOld = sOld.substring(0,40) + '...';
                        if(sNew.length > 40) sNew = sNew.substring(0,40) + '...';
                        changes.push(`<em>${key}</em>: ${sOld} ➔ <b>${sNew}</b>`);
                    }
                }
                if (changes.length > 0) {
                    detailsHtml += `<br><div style="font-size:0.85em; color:var(--text-secondary); margin-top:0.3rem">${changes.join('<br>')}</div>`;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space:nowrap">${dateStr}</td>
                <td>${userName}</td>
                <td><span style="color: ${actionColor}; font-weight: 600; font-size:0.85rem">${actionText}<br><small style="color:var(--text-secondary); font-weight:normal">${log.table_name}</small></span></td>
                <td>${detailsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error("Error cargando auditoría:", err);
        const errMsg = err.message || err.toString();
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--danger-color);">Error de base de datos: ${errMsg}<br><small>Verifica que la tabla 'audit_log' exista en Supabase y tenga permisos de lectura (RLS permitiendo SELECT).</small></td></tr>`;
    }
}

function closeAuditModal() {
    const modal = document.getElementById('audit-modal');
    if (modal) modal.classList.remove('open');
}

// --- State Cycle ---
async function cycleStatus(orderId) {
    const order = globalOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const currIdx = orderStatuses.indexOf(order.status);
    const nextIdx = (currIdx + 1) % orderStatuses.length;
    const newStatus = orderStatuses[nextIdx];

    // Si va a "listo", abrir modal de costos antes de actualizar
    if (newStatus === 'listo') {
        openCompleteOrderModal(orderId);
        return;
    }

    // Optimistic UI Update
    order.status = newStatus;
    updateAllViews();

    try {
        await dbClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);
    } catch (e) {
        console.error("Error al actualizar el estado de la orden.", e);
        // Podríamos revertir el cambio optimista aquí en caso de error
    }
}

// WhatsApp Mock
function openWhatsApp(orderId) {
    const order = globalOrders.find(o => o.id === orderId);
    if (order) {
        let sc = statusConfig[order.status].label;
        let text = `Hola ${order.client}, somos del taller. Le avisamos que la orden *${order.id}* (${order.object}) actualmente se encuentra: *${sc}*.\nCualquier consulta estamos a su disposición.`;
        let url = `https://api.whatsapp.com/send?phone=${order.contact.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        
        // As a mock for MVP, we'll optimistically update wppStatus localy
        order.wppStatus = 'notified';
        updateAllViews();
    }
}

// --- Updates & Rendering ---
function updateAllViews() {
    renderKPIs();
    renderRecentOrders();
    renderAllOrders();
    renderCustomers();
    renderReports();
    renderAgenda();
    checkDeadlines();
    lucide.createIcons(); // refresh icons injected
}

function renderKPIs() {
    const activas = globalOrders.filter(o => o.status !== 'listo' && o.status !== 'entregado').length;
    const listas = globalOrders.filter(o => o.status === 'listo').length;
    const materiales = globalOrders.filter(o => o.status === 'materiales').length;

    // Unique clients by name/phone
    const cliSet = new Set(globalOrders.map(o => o.client.toLowerCase() + o.contact));

    document.getElementById('kpi-activas').textContent = activas;
    document.getElementById('kpi-listas').textContent = listas;
    document.getElementById('kpi-materiales').textContent = materiales;
    document.getElementById('kpi-clientes').textContent = cliSet.size;

    // Nuevos KPIs para reportes
    updateReports();
}

// --- FASE 2: Reportes Avanzados ---

function getMonthRange() {
    const monthParam = document.getElementById('report-month')?.value || '';
    const endDate = new Date();
    const startDate = new Date();
    
    if (monthParam === '') {
        // Mes Actual
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    } else {
        const months = parseInt(monthParam);
        startDate.setMonth(startDate.getMonth() - months);
    }
    
    // Asegurar que abarque todo el dia actual
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
}

function getFilteredOrders() {
    const { startDate, endDate } = getMonthRange();
    return globalOrders.filter(o => {
        const dateString = o.createdAt || o.date;
        const parseString = dateString.includes('T') ? dateString : dateString + 'T12:00:00';
        const orderDate = new Date(parseString);
        return orderDate >= startDate && orderDate <= endDate;
    });
}

function calculateMarginMetrics() {
    const filtered = getFilteredOrders();
    if (filtered.length === 0) return { average: 0, total: 0, count: 0, percentage: 0 };

    let marginSum = 0;
    let marginCount = 0;
    let calculatedBudgetSum = 0;

    filtered.forEach(order => {
        if (order.service && order.service.includes('- Margen:')) {
            const marginMatch = order.service.match(/- Margen:\s*\$?([-+]?[0-9]*\.?[0-9]+)/);
            if (marginMatch) {
                marginSum += parseFloat(marginMatch[1]);
                marginCount++;
                calculatedBudgetSum += (Number(order.budget) || 0);
            }
        }
    });

    return {
        average: marginCount > 0 ? (marginSum / marginCount) : 0,
        total: marginSum,
        count: marginCount,
        percentage: (marginCount > 0 && calculatedBudgetSum > 0) ? ((marginSum / calculatedBudgetSum) * 100) : 0
    };
}

function calculateAverageClosureTime() {
    const delivered = globalOrders.filter(o => o.status === 'entregado');
    if (delivered.length === 0) return 0;

    let totalDays = 0;
    delivered.forEach(order => {
        const createdDate = new Date(order.date);
        const closedDate = new Date(); // Aproximado (usaría created_at si estuviera disponible)
        const days = Math.floor((closedDate - createdDate) / (1000 * 60 * 60 * 24));
        totalDays += Math.max(0, days);
    });

    return Math.round(totalDays / delivered.length);
}

function calculateForecast() {
    const filtered = getFilteredOrders();
    const inProgress = filtered.filter(o => 
        ['recibido', 'cotizado', 'presupuestado', 'proceso', 'materiales'].includes(o.status)
    );

    const totalBudget = inProgress.reduce((sum, o) => sum + (Number(o.budget) || 0), 0);
    
    // Proyección: asume que ~70% de las órdenes en progreso se completarán
    return totalBudget * 0.7;
}

function renderPipelineMetrics() {
    const filtered = getFilteredOrders();
    const pipelineEl = document.getElementById('pipeline-metrics');
    if (!pipelineEl) return;

    const pipeline = {};
    orderStatuses.forEach(status => {
        pipeline[status] = filtered.filter(o => o.status === status).length;
    });

    const totalCount = Object.values(pipeline).reduce((a, b) => a + b, 0);

    let html = '';
    orderStatuses.forEach(status => {
        const count = pipeline[status];
        const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
        const label = statusConfig[status]?.label || status;
        
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <strong>${label}</strong>
                    <span style="color: var(--text-secondary);">${count} (${percentage}%)</span>
                </div>
                <div style="background: var(--bg-color); border-radius: 4px; overflow: hidden; height: 24px;">
                    <div style="background: linear-gradient(90deg, var(--primary-color), var(--primary-hover)); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
    });

    pipelineEl.innerHTML = html;
}

function renderMarginMetrics() {
    const { average, total, count, percentage } = calculateMarginMetrics();
    const marginEl = document.getElementById('margin-metrics');
    if (!marginEl) return;

    const avgPercentage = percentage.toFixed(1);

    let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
                <p style="color: var(--text-secondary); margin: 0;">Margen Total</p>
                <p style="font-size: 1.5rem; font-weight: 600; margin: 0.25rem 0;">$${total.toLocaleString('es-AR', {maximumFractionDigits: 2})}</p>
            </div>
            <div>
                <p style="color: var(--text-secondary); margin: 0;">Promedio Margen</p>
                <p style="font-size: 1.5rem; font-weight: 600; margin: 0.25rem 0;">$${average.toLocaleString('es-AR', {maximumFractionDigits: 2})}</p>
            </div>
            <div>
                <p style="color: var(--text-secondary); margin: 0;">Órdenes con Costo Calculado</p>
                <p style="font-size: 1.5rem; font-weight: 600; margin: 0.25rem 0;">${count}</p>
            </div>
            <div>
                <p style="color: var(--text-secondary); margin: 0;">% Promedio</p>
                <p style="font-size: 1.5rem; font-weight: 600; margin: 0.25rem 0;">${avgPercentage}%</p>
            </div>
        </div>
    `;

    marginEl.innerHTML = html;
}

function updateReports() {
    const marginData = calculateMarginMetrics();
    const closureTime = calculateAverageClosureTime();
    const forecast = calculateForecast();
    const filtered = getFilteredOrders();
    const totalRevenue = filtered.reduce((sum, o) => sum + (Number(o.budget) || 0), 0);

    // Actualizar KPIs
    document.getElementById('kpi-ingresos').textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
    document.getElementById('kpi-margen-promedio').textContent = 
        marginData.count > 0 ? 
        `$${marginData.average.toLocaleString('es-AR', {maximumFractionDigits: 2})}` : 
        '$0';
    document.getElementById('kpi-tiempo-promedio').textContent = `${closureTime} días`;
    document.getElementById('kpi-forecast').textContent = `$${forecast.toLocaleString('es-AR')}`;

    // Renderizar métricos
    renderPipelineMetrics();
    renderMarginMetrics();
    if (typeof renderCanvasCharts === 'function') {
        renderCanvasCharts(filtered);
    }
}

function generateActionButtons(orderId, isDashboard) {
    if (isDashboard) {
        return `
            <button class="action-btn" title="Ver detalle" onclick="goToOrders()"><i data-lucide="eye" style="width:18px"></i></button>
            <button class="action-btn" title="Avanzar estado" onclick="cycleStatus('${orderId}')"><i data-lucide="fast-forward" style="width:18px"></i></button>
        `;
    }
    return `
        <button class="action-btn" title="Ver detalles" onclick="openViewOrderModal('${orderId}')"><i data-lucide="info" style="width:18px"></i></button>
        <button class="action-btn" title="Editar" onclick="openEditOrderModal('${orderId}')"><i data-lucide="edit-2" style="width:18px"></i></button>
        <button class="action-btn" title="Eliminar" style="color:var(--danger-color)" onclick="deleteOrder('${orderId}')"><i data-lucide="trash-2" style="width:18px"></i></button>
    `;
}

async function deleteOrder(id) {
    if (confirm("¿Eliminar definitivamente la orden " + id + "?")) {
        const order = globalOrders.find(o => o.id === id);
        if (!order) return;
        
        try {
            await dbClient
                .from('orders')
                .delete()
                .eq('id', order.dbId)
                .eq('tenant_id', DEFAULT_TENANT_ID);
            await initData();
        } catch (e) {
            console.error("Error al borrar", e);
        }
    }
}

function renderRecentOrders() {
    const tb = document.getElementById('recent-orders-tbody');
    if (!tb) return;
    tb.innerHTML = '';

    const recentPending = globalOrders.filter(o => o.status !== 'entregado').slice(0, 3);
    recentPending.forEach(order => {
        const sc = statusConfig[order.status];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-color)">${order.id}</td>
            <td><div class="client-info"><span class="client-name">${order.client}</span></div></td>
            <td>${order.object}</td>
            <td>${order.date}</td>
            <td><span class="status ${sc.class}" style="cursor:pointer" onclick="cycleStatus('${order.id}')" title="Clic para avanzar">${sc.label}</span></td>
            <td><div class="actions-cell">${generateActionButtons(order.id, true)}</div></td>
        `;
        tb.appendChild(tr);
    });
}

function renderAllOrders() {
    const tb = document.getElementById('all-orders-tbody');
    if (!tb) return;
    tb.innerHTML = '';

    const textSearch = filterText.value.toLowerCase() || globalSearch.value.toLowerCase();
    const statusSearch = filterStatus.value;

    const filtered = globalOrders.filter(order => {
        const matchText = order.client.toLowerCase().includes(textSearch) ||
            order.object.toLowerCase().includes(textSearch) ||
            order.id.toLowerCase().includes(textSearch);
        const matchStatus = statusSearch === "" || order.status === statusSearch;
        return matchText && matchStatus;
    });

    filtered.forEach(order => {
        // Formato de fecha DD/MM/AA y días restantes
        let formattedDate = order.date;
        let daysRemainingText = '';
        try {
            const dateObj = new Date(order.date);
            if (!isNaN(dateObj.getTime())) {
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = String(dateObj.getFullYear()).slice(-2);
                formattedDate = `${day}/${month}/${year}`;

                const today = new Date();
                today.setHours(0,0,0,0);
                const diffMs = dateObj.setHours(0,0,0,0) - today.getTime();
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                    daysRemainingText = `${diffDays} días restantes`;
                } else if (diffDays === 0) {
                    daysRemainingText = 'Hoy vence';
                } else {
                    daysRemainingText = `${Math.abs(diffDays)} días vencidos`;
                }
            }
        } catch (e) {
            // deja valores originales si fecha inválida
        }
        order.formattedDate = formattedDate;
        order.daysRemainingText = daysRemainingText;

        const sc = statusConfig[order.status];
        let wppClass = order.wppStatus === 'notified' ? 'secondary-color' : 'text-secondary';
        let wppIcon = order.wppStatus === 'notified' ? 'check-check' : 'send';
        let wppText = order.wppStatus === 'notified' ? 'Enviado' : 'Avisar';

        // Limpia la descripción para no mostrar escandallo aquí
        let serviceText = order.service || '';
        if (serviceText.includes('---\nEscandallo')) {
            serviceText = serviceText.split('---\nEscandallo')[0].trim();
        }
        if (serviceText.includes('- Costo hora:')) {
            serviceText = serviceText.split('- Costo hora:')[0].trim();
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="# Orden" style="font-weight:600; color:var(--primary-color)">${order.id}</td>
            <td data-label="Cliente">
                <div class="client-info">
                    <span class="client-name">${order.client}</span>
                    <span class="client-contact">${order.contact}</span>
                </div>
            </td>
            <td data-label="Objeto / Trabajo">
                <div style="font-weight:500">${order.object}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">${serviceText}</div>
            </td>
            <td data-label="Fecha Est.">
                <div style="font-weight:500;">${order.formattedDate || order.date}</div>
                <div style="font-size:0.75rem; color: var(--text-secondary); margin-top:0.2rem;">${order.daysRemainingText || ''}</div>
            </td>
            <td data-label="Estado"><span class="status ${sc.class}" style="cursor:pointer" onclick="cycleStatus('${order.id}')" title="Clic para avanzar">${sc.label}</span></td>
            <td data-label="Notif. Whatsapp" style="font-size:0.85rem; font-weight:500;">
                <button class="btn-secondary" style="padding:0.3rem 0.6rem; display:flex; align-items:center; gap:0.4rem; font-size:0.8rem" onclick="openWhatsApp('${order.id}')">
                    <i data-lucide="${wppIcon}" style="color:var(--${wppClass}); width:16px"></i> 
                    ${wppText}
                </button>
            </td>
            <td class="actions-col" data-label="Acciones"><div class="actions-cell">${generateActionButtons(order.id, false)}</div></td>
        `;
        tb.appendChild(tr);
    });
    lucide.createIcons(); // Refresh icons after rendering
}

function renderCustomers() {
    const tb = document.getElementById('customers-tbody');
    if (!tb) return;
    tb.innerHTML = '';

    // Group orders by client
    const cmap = new Map();
    globalOrders.forEach(o => {
        // Normalizar nombre a minúsculas para agrupación (ignora MAYÚSCULAS)
        const cleanName = o.client ? o.client.trim().toLowerCase() : 'desconocido';
        
        // Normalizar teléfono (solo números, y limpiar códigos de país como +549)
        let cleanPhone = o.contact ? o.contact.replace(/\D/g, '') : '';
        if (cleanPhone.startsWith('549')) cleanPhone = cleanPhone.substring(3);
        if (cleanPhone.startsWith('54')) cleanPhone = cleanPhone.substring(2);

        const key = cleanName + '-' + cleanPhone;

        if (!cmap.has(key)) {
            cmap.set(key, {
                name: o.client.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()), // Título (ej: Juan Perez)
                phone: cleanPhone,
                email: o.email || '-',
                count: 0
            });
        }
        cmap.get(key).count += 1;
    });

    Array.from(cmap.values()).forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:500">${c.name}</td>
            <td>${c.phone}</td>
            <td>${c.email}</td>
            <td><span class="badge" style="position:static; display:inline-block; padding: 0.2rem 0.6rem; border-radius:12px; background:var(--primary-light); color:var(--primary-color)">${c.count}</span></td>
        `;
        tb.appendChild(tr);
    });
}

function renderReports() {
    updateReports();
}

function renderCanvasCharts(filteredOrders) {
    // Prepare data for charts
    if (typeof Chart === 'undefined') return;

    // Destroy existing charts to replace them
    if (statusChartInstance) statusChartInstance.destroy();
    if (revenueChartInstance) revenueChartInstance.destroy();
    if (topClientsChartInstance) topClientsChartInstance.destroy();

    // Chart 1: Distribución de Estados
    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus) {
        const statusCounts = orderStatuses.map(st => filteredOrders.filter(o => o.status === st).length);
        const statusLabels = orderStatuses.map(st => statusConfig[st].label);
        
        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusCounts,
                    backgroundColor: [
                        '#EEF2FF', '#FEF3C7', '#FEE2E2', '#D1FAE5', '#F3F4F6'
                    ],
                    borderColor: [
                        '#4F46E5', '#F59E0B', '#EF4444', '#10B981', '#6B7280'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Chart 2: Ingresos por Mes (Trend using global orders)
    const ctxRevenue = document.getElementById('revenueChart');
    if (ctxRevenue) {
        const ingresosPorMes = {};
        globalOrders.forEach(o => {
            if (!o.date) return;
            // fix timezone day shift bug
            const d = new Date(o.date + "T12:00:00");
            const mesAnio = `${d.getMonth() + 1}/${d.getFullYear()}`;
            if (!ingresosPorMes[mesAnio]) ingresosPorMes[mesAnio] = 0;
            ingresosPorMes[mesAnio] += (parseFloat(o.budget) || 0);
        });

        // Sort properly by date
        const sortedMonths = Object.keys(ingresosPorMes).sort((a,b) => {
            const [mA, yA] = a.split('/').map(Number);
            const [mB, yB] = b.split('/').map(Number);
            return yA === yB ? mA - mB : yA - yB;
        });

        const mesesLabels = sortedMonths;
        const mesesData = sortedMonths.map(m => ingresosPorMes[m]);

        revenueChartInstance = new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: mesesLabels.length ? mesesLabels : ['Sin datos'],
                datasets: [{
                    label: 'Ingresos ($)',
                    data: mesesData.length ? mesesData : [0],
                    backgroundColor: '#4F46E5',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Chart 3: Top Clientes Frecuentes
    const ctxClients = document.getElementById('topClientsChart');
    if (ctxClients) {
        const cmap = new Map();
        filteredOrders.forEach(o => {
            const key = o.client;
            if (!cmap.has(key)) cmap.set(key, 0);
            cmap.set(key, cmap.get(key) + 1);
        });

        const sortedClients = Array.from(cmap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const clientLabels = sortedClients.map(c => c[0]);
        const clientData = sortedClients.map(c => c[1]);

        topClientsChartInstance = new Chart(ctxClients, {
            type: 'bar',
            data: {
                labels: clientLabels.length ? clientLabels : ['Sin datos'],
                datasets: [{
                    label: 'Trabajos',
                    data: clientData.length ? clientData : [0],
                    backgroundColor: '#10B981',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    x: { beginAtZero: true, ticks: { stepSize: 1 } } 
                }
            }
        });
    }
}

// --- Agenda Rendering ---
function prevMonth() {
    currentAgendaDate.setMonth(currentAgendaDate.getMonth() - 1);
    renderAgenda();
}

function nextMonth() {
    currentAgendaDate.setMonth(currentAgendaDate.getMonth() + 1);
    renderAgenda();
}

function changeCalendarDate() {
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (monthSelect && yearSelect) {
        currentAgendaDate.setFullYear(parseInt(yearSelect.value, 10));
        currentAgendaDate.setMonth(parseInt(monthSelect.value, 10));
        renderAgenda();
    }
}

function renderAgenda() {
    const calendarDaysEl = document.getElementById('calendar-days');
    if (!calendarDaysEl) return;

    const year = currentAgendaDate.getFullYear();
    const month = currentAgendaDate.getMonth();

    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');

    if (yearSelect && yearSelect.options.length === 0) {
        const currentYearObj = new Date().getFullYear();
        for (let y = currentYearObj - 2; y <= currentYearObj + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        }
    }

    if (monthSelect && yearSelect) {
        monthSelect.value = month;
        yearSelect.value = year;
    }

    calendarDaysEl.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    // Blank cells for previous month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDaysEl.appendChild(emptyCell);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (isCurrentMonth && day === today.getDate()) {
            dayCell.classList.add('today');
        }

        const dateNum = document.createElement('div');
        dateNum.className = 'calendar-date-number';
        dateNum.textContent = day;
        dayCell.appendChild(dateNum);

        // Find orders for this day
        // Orders date format is YYYY-MM-DD
        const loopDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayOrders = globalOrders.filter(o => {
            if (!o.date) return false;
            return o.date.startsWith(loopDateStr);
        });

        dayOrders.forEach(order => {
            const ev = document.createElement('div');
            ev.className = `calendar-event status-${order.status}`;
            ev.textContent = `#${order.id} - ${order.client}`;
            
            const cleanService = order.service ? order.service.replace(/\[Añadido por:.*?\]\n?/g, '').trim() : '';
            ev.title = `Cliente: ${order.client}\nProducto: ${order.object}\nDetalle/Problema: ${cleanService}\nEstado: ${statusConfig[order.status].label}`;
            
            dayCell.appendChild(ev);
        });

        calendarDaysEl.appendChild(dayCell);
    }
}

// --- Notifications Deadlines ---
function checkDeadlines() {
    const msInDay = 86400000;
    const tomorrowDate = new Date(Date.now() + msInDay);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    globalOrders.forEach(o => {
        if (o.status !== 'listo' && o.status !== 'entregado' && o.date === tomorrowStr) {
            if (!notifiedDeadlines.has(o.id)) {
                notifiedDeadlines.add(o.id);
                showToast(`¡Aviso! Trabajo #${o.id} de ${o.client} vence mañana.`);
                appNotifications.push({
                    title: `Vencimiento Próximo: ${o.client}`,
                    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                });
                if(typeof updateNotificationsUI === 'function') updateNotificationsUI();
            }
        }
    });
}

// Filter listeners
filterText.addEventListener('input', () => { renderAllOrders(); lucide.createIcons(); });
globalSearch.addEventListener('input', () => { 
    goToOrders();
    renderAllOrders(); 
    lucide.createIcons(); 
});
filterStatus.addEventListener('change', () => { renderAllOrders(); lucide.createIcons(); });

// --- Notifications UI ---
function updateNotificationsUI() {
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notifications-list');
    if(!badge || !list) return;

    if (appNotifications.length > 0) {
        badge.style.display = 'flex';
        badge.textContent = appNotifications.length;
        
        list.innerHTML = '';
        appNotifications.forEach(n => {
            list.innerHTML += `
                <div class="notification-item" onclick="goToOrders(); toggleNotifications()">
                    <div class="notification-icon"><i data-lucide="user-plus"></i></div>
                    <div class="notification-content">
                        <div class="notification-title">${n.title}</div>
                        <div class="notification-time">${n.time}</div>
                    </div>
                </div>
            `;
        });
        lucide.createIcons();
    } else {
        badge.style.display = 'none';
        list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">No hay notificaciones nuevas</div>';
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notifications-dropdown');
    if(dropdown) dropdown.classList.toggle('active');
}

function clearNotifications() {
    appNotifications = [];
    updateNotificationsUI();
    const dropdown = document.getElementById('notifications-dropdown');
    if(dropdown) dropdown.classList.remove('active');
}

// --- Dark Mode ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    // Update button UI
    const textSpan = document.getElementById('dark-mode-text');
    const iconIcon = document.getElementById('dark-mode-icon');
    if (textSpan && iconIcon) {
        textSpan.textContent = isDark ? 'Desactivar Modo Oscuro' : 'Activar Modo Oscuro';
        iconIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

// --- Auth UI ---
function closeLoginModal() {
    if(!currentUser) {
        alert("Debes ingresar un nombre para continuar.");
        return;
    }
    document.getElementById('login-modal').classList.remove('open');
}

function submitLogin() {
    const name = document.getElementById('form-username').value.trim();
    if (!name) {
        document.getElementById('hidden-login-submit').click(); // trigger HTML5 validation
        return;
    }
    currentUser = name;
    localStorage.setItem('currentUser', currentUser);
    updateUserUI();
    document.getElementById('login-modal').classList.remove('open');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initData();
    
    // Auth Init
    if (!currentUser) {
        openLoginModal();
    } else {
        updateUserUI();
    }
    
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const textSpan = document.getElementById('dark-mode-text');
        const iconIcon = document.getElementById('dark-mode-icon');
        if (textSpan && iconIcon) {
            textSpan.textContent = 'Desactivar Modo Oscuro';
            iconIcon.setAttribute('data-lucide', 'sun');
        }
    }
    
    // Complete order modal cost calculator inputs listeners
    const completeHourlyRateField = document.getElementById('complete-hourly-rate');
    const completeLaborHoursField = document.getElementById('complete-labor-hours');
    const completeMaterialCostField = document.getElementById('complete-material-cost');

    if (completeHourlyRateField) completeHourlyRateField.addEventListener('input', saveCompleteCostSettings);
    if (completeLaborHoursField) completeLaborHoursField.addEventListener('input', calculateCompleteCost);
    if (completeMaterialCostField) completeMaterialCostField.addEventListener('input', calculateCompleteCost);

    // Configura actualización constante cada 10 segundos
    setInterval(pollData, 10000); 
});
