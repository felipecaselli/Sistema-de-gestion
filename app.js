// Initialize Lucide Icons
lucide.createIcons();

// --- Configuration & Initialization ---
const STORAGE_KEY = 'craftflow_orders';
const orderStatuses = ['recibido', 'proceso', 'materiales', 'listo'];

const statusConfig = {
    recibido: { label: "Recibido", class: "status-received" },
    proceso: { label: "En Proceso", class: "status-process" },
    materiales: { label: "Espera Mat.", class: "status-materials" },
    listo: { label: "Listo p/ Entrega", class: "status-ready" }
};

const defaultOrders = [
    {
        id: "OT-1025",
        client: "María Gómez",
        contact: "+54 9 11 4444-5555",
        email: "maria@example.com",
        object: "Sillón Luis XV",
        service: "Restauración tapizado",
        date: "2026-04-10",
        budget: "45000",
        status: "proceso",
        wppStatus: "notified"
    },
    {
        id: "OT-1026",
        client: "Roberto Sánchez",
        contact: "+54 9 11 2222-3333",
        email: "",
        object: "Mesa comedor pino",
        service: "Lijado y barnizado",
        date: "2026-04-02",
        budget: "20000",
        status: "listo",
        wppStatus: "notified"
    },
    {
        id: "OT-1027",
        client: "Julieta Fernández",
        contact: "+54 9 11 7777-8888",
        email: "juli@example.com",
        object: "Guitarra Criolla",
        service: "Cambio de clavijas",
        date: "2026-04-15",
        budget: "12000",
        status: "materiales",
        wppStatus: "pending"
    }
];

let globalOrders = [];

function initData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        globalOrders = [...defaultOrders];
        saveData();
    } else {
        globalOrders = JSON.parse(data);
    }
    updateAllViews();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalOrders));
}

function clearData() {
    if (confirm("¿Estás seguro de que quieres restaurar los datos de prueba?")) {
        localStorage.removeItem(STORAGE_KEY);
        initData();
    }
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

function submitOrder() {
    const form = document.getElementById('new-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-submit').click();
        return;
    }

    // Determine new ID
    const maxNumber = globalOrders.reduce((max, order) => {
        const num = parseInt(order.id.split('-')[1]);
        return num > max ? num : max;
    }, 1000);

    const newOrder = {
        id: `OT-${maxNumber + 1}`,
        client: document.getElementById('form-client').value,
        contact: document.getElementById('form-phone').value,
        email: document.getElementById('form-email').value,
        object: document.getElementById('form-object').value,
        service: document.getElementById('form-service').value,
        budget: document.getElementById('form-budget').value,
        date: document.getElementById('form-date').value,
        status: "recibido",
        wppStatus: "pending"
    };

    globalOrders.unshift(newOrder); // add to top
    saveData();
    updateAllViews();
    closeOrderModal();
    // Simulate WhatsApp notification
    alert(`Orden ${newOrder.id} creada exitosamente. WhatsApp automático omitido en entorno de prueba.`);
}

// Close modal when clicking outside
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeOrderModal();
});


// --- State Cycle ---
function cycleStatus(orderId) {
    const order = globalOrders.find(o => o.id === orderId);
    if (order) {
        const currIdx = orderStatuses.indexOf(order.status);
        const nextIdx = (currIdx + 1) % orderStatuses.length;
        order.status = orderStatuses[nextIdx];

        // If it returns to recibido or process, pending... if listo -> wpp is pending manually notified
        saveData();
        updateAllViews();
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

        order.wppStatus = 'notified';
        saveData();
        updateAllViews();
    }
}

// --- Updates & Rendering ---
function updateAllViews() {
    renderKPIs();
    renderRecentOrders();
    renderAllOrders();
    renderCustomers();
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

function deleteOrder(id) {
    if (confirm("¿Eliminar definitivamente la orden " + id + "?")) {
        globalOrders = globalOrders.filter(o => o.id !== id);
        saveData();
        updateAllViews();
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
        const key = o.client.toLowerCase() + o.contact;
        if (!cmap.has(key)) {
            cmap.set(key, {
                name: o.client,
                phone: o.contact,
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

// Filter listeners
filterText.addEventListener('input', () => { renderAllOrders(); lucide.createIcons(); });
globalSearch.addEventListener('input', () => { renderAllOrders(); lucide.createIcons(); });
filterStatus.addEventListener('change', () => { renderAllOrders(); lucide.createIcons(); });

// Init
document.addEventListener('DOMContentLoaded', () => {
    initData();
});
