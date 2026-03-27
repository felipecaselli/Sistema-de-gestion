// Initialize Lucide Icons
lucide.createIcons();

// --- Configuration & Initialization ---
const supabaseUrl = 'https://rpvxndvoekhmzavpbgik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdnhuZHZvZWtobXphdnBiZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDc0NjcsImV4cCI6MjA5MDEyMzQ2N30.AjG_Ng-xPXgGfoVQL5G5a1Y-Zdcjtn8yagV29RBy910';
// Evitar conflicto con la variable global 'supabase' de Supabase CDN:
const dbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const DEFAULT_TENANT_ID = 'taller-demo';
const orderStatuses = ['recibido', 'proceso', 'materiales', 'listo'];

const statusConfig = {
    recibido: { label: "Recibido", class: "status-received" },
    proceso: { label: "En Proceso", class: "status-process" },
    materiales: { label: "Espera Mat.", class: "status-materials" },
    listo: { label: "Listo p/ Entrega", class: "status-ready" }
};

let globalOrders = [];
let appNotifications = [];
let currentUser = localStorage.getItem('currentUser') || '';

// --- Chart Instances ---
let statusChartInstance = null;
let revenueChartInstance = null;
let topClientsChartInstance = null;

async function initData() {
    try {
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .order('created_at', { ascending: false });

        if (!error && data) {
            globalOrders = data.map(o => ({
                id: `OT-${o.id.toString().substring(0,8)}`,
                dbId: o.id,
                client: o.client_name,
                contact: o.contact_phone,
                email: o.email || '',
                object: o.object_name,
                service: o.service_details,
                budget: o.budget || 0,
                date: o.estimated_date || o.created_at.split('T')[0],
                status: o.status,
                wppStatus: o.wpp_status
            }));
        }
    } catch (err) {
        console.error("SDK Error:", err);
    }
    updateAllViews();
}

// Auto-Polling Realtime App Sync via Supabase
async function pollData() {
    try {
        const { data, error } = await dbClient
            .from('orders')
            .select('*')
            .eq('tenant_id', DEFAULT_TENANT_ID)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const newOrders = data.map(o => ({
                id: `OT-${o.id.toString().substring(0,8)}`,
                dbId: o.id,
                client: o.client_name,
                contact: o.contact_phone,
                email: o.email || '',
                object: o.object_name,
                service: o.service_details,
                budget: o.budget || 0,
                date: o.estimated_date || o.created_at.split('T')[0],
                status: o.status,
                wppStatus: o.wpp_status
            }));
            
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

function showToast(message) {
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
    toast.style.background = 'var(--primary-color, #4F46E5)';
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
    toast.innerHTML = `<i data-lucide="bell" style="width:20px;height:20px;"></i> ${message}`;
    
    container.appendChild(toast);
    lucide.createIcons();

    // Notificación en el sistema operativo
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('Aviso Taller', { body: message });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification('Aviso Taller', { body: message });
            });
        }
    }

    // Auto-destrucción visual del globo flotante
    setTimeout(() => {
        toast.style.animation = 'slideOutFade 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400);
    }, 6000); // Se va a los 6 segundos
}

// Configurar permiso preventivo de notificaciones al primer clic que hagas en la página web
if ('Notification' in window && Notification.permission !== 'denied') {
    document.addEventListener('click', () => Notification.requestPermission(), {once: true});
}

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

// --- Modal Handlers ---
function openOrderModal() {
    document.getElementById('new-order-form').reset();
    document.getElementById('form-date').valueAsDate = new Date();
    modalOverlay.classList.add('open');
}

function closeOrderModal() {
    modalOverlay.classList.remove('open');
}

async function submitOrder() {
    const form = document.getElementById('new-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-submit').click();
        return;
    }

    const baseServiceDetails = document.getElementById('form-service').value;
    const finalServiceDetails = `[Añadido por: ${currentUser || 'Desconocido'}]\n${baseServiceDetails}`;

    const payload = {
        tenant_id: DEFAULT_TENANT_ID,
        client_name: document.getElementById('form-client').value,
        contact_phone: document.getElementById('form-phone').value,
        email: document.getElementById('form-email').value,
        object_name: document.getElementById('form-object').value,
        service_details: finalServiceDetails,
        budget: document.getElementById('form-budget').value,
        estimated_date: document.getElementById('form-date').value,
        status: "recibido",
        wpp_status: "pending"
    };

    try {
        const { error } = await dbClient
            .from('orders')
            .insert([payload]);

        if (!error) {
            await initData(); // Refrescar los datos desde Supabase
            closeOrderModal();
        } else {
            alert("Error de Supabase al guardar la orden: " + error.message);
        }
    } catch (e) {
        console.error(e);
        alert("Error de red al guardar la orden.");
    }
}

// Close modal when clicking outside
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeOrderModal();
});


// --- State Cycle ---
async function cycleStatus(orderId) {
    const order = globalOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const currIdx = orderStatuses.indexOf(order.status);
    const nextIdx = (currIdx + 1) % orderStatuses.length;
    const newStatus = orderStatuses[nextIdx];

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
    lucide.createIcons(); // refresh icons injected
}

function renderKPIs() {
    const activas = globalOrders.filter(o => o.status !== 'listo').length;
    const listas = globalOrders.filter(o => o.status === 'listo').length;
    const materiales = globalOrders.filter(o => o.status === 'materiales').length;

    // Unique clients by name/phone
    const cliSet = new Set(globalOrders.map(o => o.client.toLowerCase() + o.contact));

    document.getElementById('kpi-activas').textContent = activas;
    document.getElementById('kpi-listas').textContent = listas;
    document.getElementById('kpi-materiales').textContent = materiales;
    document.getElementById('kpi-clientes').textContent = cliSet.size;
}

function generateActionButtons(orderId, isDashboard) {
    if (isDashboard) {
        return `
            <button class="action-btn" title="Ver detalle" onclick="goToOrders()"><i data-lucide="eye" style="width:18px"></i></button>
            <button class="action-btn" title="Avanzar estado" onclick="cycleStatus('${orderId}')"><i data-lucide="fast-forward" style="width:18px"></i></button>
        `;
    }
    return `
        <button class="action-btn" title="Avanzar estado" onclick="cycleStatus('${orderId}')"><i data-lucide="fast-forward" style="width:18px"></i></button>
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

    globalOrders.slice(0, 3).forEach(order => {
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
        const sc = statusConfig[order.status];
        let wppClass = order.wppStatus === 'notified' ? 'secondary-color' : 'text-secondary';
        let wppIcon = order.wppStatus === 'notified' ? 'check-check' : 'send';
        let wppText = order.wppStatus === 'notified' ? 'Enviado' : 'Avisar';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-color)">${order.id}</td>
            <td>
                <div class="client-info">
                    <span class="client-name">${order.client}</span>
                    <span class="client-contact">${order.contact}</span>
                </div>
            </td>
            <td>
                <div style="font-weight:500">${order.object}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">${order.service}</div>
            </td>
            <td>${order.date}</td>
            <td style="font-weight:500; color:var(--text-main)">$${Number(order.budget || 0).toLocaleString('es-AR')}</td>
            <td><span class="status ${sc.class}" style="cursor:pointer" onclick="cycleStatus('${order.id}')" title="Clic para avanzar">${sc.label}</span></td>
            <td style="font-size:0.85rem; font-weight:500;">
                <button class="btn-secondary" style="padding:0.3rem 0.6rem; display:flex; align-items:center; gap:0.4rem; font-size:0.8rem" onclick="openWhatsApp('${order.id}')">
                    <i data-lucide="${wppIcon}" style="color:var(--${wppClass}); width:16px"></i> 
                    ${wppText}
                </button>
            </td>
            <td><div class="actions-cell">${generateActionButtons(order.id, false)}</div></td>
        `;
        tb.appendChild(tr);
    });
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
    // 1. KPI Total Ingresos Estimados
    const totalIngresos = globalOrders.reduce((sum, o) => {
        return sum + (parseFloat(o.budget) || 0);
    }, 0);
    const kpiIngresos = document.getElementById('kpi-ingresos');
    if (kpiIngresos) kpiIngresos.textContent = `$${totalIngresos.toLocaleString('es-AR')}`;

    // Prepare data for charts
    if (typeof Chart === 'undefined') return;

    // Destroy existing charts to replace them (avoid canvas reuse issue)
    if (statusChartInstance) statusChartInstance.destroy();
    if (revenueChartInstance) revenueChartInstance.destroy();
    if (topClientsChartInstance) topClientsChartInstance.destroy();

    // Chart 1: Distribución de Estados
    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus) {
        const statusCounts = orderStatuses.map(st => globalOrders.filter(o => o.status === st).length);
        const statusLabels = orderStatuses.map(st => statusConfig[st].label);
        
        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusCounts,
                    backgroundColor: [
                        '#EEF2FF', // recibido (primary-light)
                        '#FEF3C7', // proceso (warning-light)
                        '#FEE2E2', // materiales (danger-light)
                        '#D1FAE5'  // listo (secondary-light)
                    ],
                    borderColor: [
                        '#4F46E5', // primary
                        '#F59E0B', // warning
                        '#EF4444', // danger
                        '#10B981'  // secondary
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

    // Chart 2: Ingresos por Mes
    const ctxRevenue = document.getElementById('revenueChart');
    if (ctxRevenue) {
        const ingresosPorMes = {};
        globalOrders.forEach(o => {
            if (!o.date) return;
            const d = new Date(o.date);
            const mesAnio = `${d.getMonth() + 1}/${d.getFullYear()}`;
            if (!ingresosPorMes[mesAnio]) ingresosPorMes[mesAnio] = 0;
            ingresosPorMes[mesAnio] += (parseFloat(o.budget) || 0);
        });

        const mesesLabels = Object.keys(ingresosPorMes);
        const mesesData = Object.values(ingresosPorMes);

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
        globalOrders.forEach(o => {
            const key = o.client;
            if (!cmap.has(key)) cmap.set(key, 0);
            cmap.set(key, cmap.get(key) + 1);
        });

        // Ordenar clientes por cantidad de trabajos y tomar los primeros 5
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

// Filter listeners
filterText.addEventListener('input', () => { renderAllOrders(); lucide.createIcons(); });
globalSearch.addEventListener('input', () => { renderAllOrders(); lucide.createIcons(); });
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
function updateUserUI() {
    const avatar = document.getElementById('user-avatar');
    const nameDisplay = document.getElementById('user-name-display');
    if (currentUser) {
        if(avatar) avatar.textContent = currentUser.charAt(0).toUpperCase();
        if(nameDisplay) nameDisplay.textContent = currentUser;
    } else {
        if(avatar) avatar.textContent = '?';
        if(nameDisplay) nameDisplay.textContent = 'Desconocido';
    }
}

function openLoginModal() {
    document.getElementById('form-username').value = currentUser;
    document.getElementById('login-modal').classList.add('open');
    document.getElementById('login-close-btn').style.display = currentUser ? 'block' : 'none';
}

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
    
    // Configura actualización constante cada 10 segundos
    setInterval(pollData, 10000); 
});
