// Initialize Lucide Icons
lucide.createIcons();

// --- Configuration & Initialization ---
const supabaseUrl = 'https://rpvxndvoekhmzavpbgik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdnhuZHZvZWtobXphdnBiZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDc0NjcsImV4cCI6MjA5MDEyMzQ2N30.AjG_Ng-xPXgGfoVQL5G5a1Y-Zdcjtn8yagV29RBy910';
// Evitar conflicto con la variable global 'supabase' de Supabase CDN:
const dbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const DEFAULT_TENANT_ID = 'taller-demo';
const orderStatuses = ['recibido', 'proceso', 'materiales', 'listo', 'entregado'];

const statusConfig = {
    recibido: { label: "Recibido", class: "status-received" },
    proceso: { label: "En Proceso", class: "status-process" },
    materiales: { label: "Espera Mat.", class: "status-materials" },
    listo: { label: "Listo p/ Entrega", class: "status-ready" },
    entregado: { label: "Entregado", class: "status-delivered" }
};

let globalOrders = [];
let appNotifications = [];
let currentUser = localStorage.getItem('currentUser') || '';
let notifiedDeadlines = new Set();

// --- Agenda State ---
let currentAgendaDate = new Date();

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
function openOrderModal() {
    document.getElementById('new-order-form').reset();
    document.getElementById('form-date').valueAsDate = new Date();
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
        await dbClient
            .from('orders')
            .update({
                status: 'listo',
                service_details: finalServiceDetails
            })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

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

    try {
        await dbClient
            .from('orders')
            .update({
                client_name: document.getElementById('edit-form-client').value,
                contact_phone: document.getElementById('edit-form-phone').value,
                email: document.getElementById('edit-form-email').value,
                object_name: document.getElementById('edit-form-object').value,
                service_details: document.getElementById('edit-form-service').value,
                budget: document.getElementById('edit-form-budget').value,
                estimated_date: document.getElementById('edit-form-date').value
            })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

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
}

function closeViewOrderModal() {
    document.getElementById('view-order-modal').classList.remove('open');
    pendingViewOrderId = null;
}

async function updateOrderBudget() {
    if (!pendingViewOrderId) return;

    const order = globalOrders.find(o => o.id === pendingViewOrderId);
    if (!order) return;

    const newBudget = Number(document.getElementById('view-edit-budget').value) || 0;

    try {
        await dbClient
            .from('orders')
            .update({ budget: newBudget })
            .eq('id', order.dbId)
            .eq('tenant_id', DEFAULT_TENANT_ID);

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
    // 1. KPI Total Ingresos Estimados
    const totalIngresos = globalOrders.reduce((sum, o) => {
        return sum + (parseFloat(o.budget) || 0);
    }, 0);
    const kpiIngresos = document.getElementById('kpi-ingresos');
    if (kpiIngresos) kpiIngresos.textContent = `$${totalIngresos.toLocaleString('es-AR')}`;

    // 1b. KPI Ingresos Efectivos (Solo Entregados)
    const ingresosEfectivos = globalOrders.reduce((sum, o) => {
        if (o.status === 'entregado') return sum + (parseFloat(o.budget) || 0);
        return sum;
    }, 0);
    const kpiEfectivos = document.getElementById('kpi-ingresos-efectivos');
    if (kpiEfectivos) kpiEfectivos.textContent = `$${ingresosEfectivos.toLocaleString('es-AR')}`;

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
                        '#D1FAE5', // listo (secondary-light)
                        '#F3F4F6'  // entregado (delivered-light)
                    ],
                    borderColor: [
                        '#4F46E5', // primary
                        '#F59E0B', // warning
                        '#EF4444', // danger
                        '#10B981', // secondary
                        '#6B7280'  // delivered gray
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
function updateUserUI() {
    const avatar = document.getElementById('user-avatar');
    const nameDisplay = document.getElementById('user-name-display');
    const greetingTitle = document.getElementById('greeting-title');

    let displayUser = currentUser ? currentUser : 'Desconocido';

    if (avatar) avatar.textContent = currentUser ? currentUser.charAt(0).toUpperCase() : '?';
    if (nameDisplay) nameDisplay.textContent = displayUser;

    if (greetingTitle) {
        greetingTitle.innerHTML = `Hola ${displayUser}, <span style="color:var(--text-secondary);font-weight:400">bienvenido al taller</span>`;
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
