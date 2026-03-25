// Initialize Lucide Icons
lucide.createIcons();

// --- Mock Data ---
const mockOrders = [
    {
        id: "OT-1025",
        client: "María Gómez",
        contact: "+54 9 11 4444-5555",
        object: "Sillón Luis XV",
        service: "Restauración tapizado",
        date: "2026-04-10",
        status: "proceso",
        wppStatus: "notified" // or pending
    },
    {
        id: "OT-1026",
        client: "Roberto Sánchez",
        contact: "+54 9 11 2222-3333",
        object: "Mesa comedor pino",
        service: "Lijado y barnizado",
        date: "2026-04-02",
        status: "listo",
        wppStatus: "notified" 
    },
    {
        id: "OT-1027",
        client: "Julieta Fernández",
        contact: "+54 9 11 7777-8888",
        object: "Guitarra Criolla",
        service: "Cambio de puente",
        date: "2026-04-15",
        status: "materiales",
        wppStatus: "pending" 
    },
    {
        id: "OT-1028",
        client: "Carlos Ruiz",
        contact: "carlos@email.com",
        object: "Cofre de plata",
        service: "Pulido y bisagras",
        date: "2026-04-20",
        status: "recibido",
        wppStatus: "pending" 
    }
];

const statusConfig = {
    recibido: { label: "Recibido", class: "status-received" },
    proceso: { label: "En Proceso", class: "status-process" },
    materiales: { label: "Espera Mat.", class: "status-materials" },
    listo: { label: "Listo p/ Entrega", class: "status-ready" }
};

// --- DOM Elements ---
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page-container');
const modalOverlay = document.getElementById('order-modal');
const dashboardTableBody = document.getElementById('recent-orders-tbody');
const ordersTableBody = document.getElementById('all-orders-tbody');

// --- Navigation ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        pages.forEach(page => page.classList.remove('active'));
        
        // Add active to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(`${targetId}-page`).classList.add('active');
        
        // Re-render icons if needed but lucide does mutations observer usually, 
        // to be safe we can run:
        // lucide.createIcons();
    });
});

// --- Modal Handlers ---
function openOrderModal() {
    modalOverlay.classList.add('open');
}

function closeOrderModal() {
    modalOverlay.classList.remove('open');
}

function submitOrder() {
    // In a real app we'd collect data
    alert('Orden guardada y notificacion enviada vía Integración WhatsApp.');
    closeOrderModal();
}

// Close modal when clicking outside
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeOrderModal();
    }
});

// --- Render Tables ---
function renderRecentOrders() {
    if(!dashboardTableBody) return;
    dashboardTableBody.innerHTML = '';
    
    mockOrders.slice(0, 3).forEach(order => {
        const sc = statusConfig[order.status];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary-color)">${order.id}</td>
            <td>
                <div class="client-info">
                    <span class="client-name">${order.client}</span>
                </div>
            </td>
            <td>${order.object}</td>
            <td>${order.date}</td>
            <td><span class="status ${sc.class}">${sc.label}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn" title="Ver detalle"><i data-lucide="eye" style="width:18px"></i></button>
                    <button class="action-btn" title="Actualizar estado"><i data-lucide="edit-2" style="width:18px"></i></button>
                </div>
            </td>
        `;
        dashboardTableBody.appendChild(tr);
    });
}

function renderAllOrders() {
    if(!ordersTableBody) return;
    ordersTableBody.innerHTML = '';
    
    mockOrders.forEach(order => {
        const sc = statusConfig[order.status];
        
        // Wpp badge
        let wppBadge = order.wppStatus === 'notified' 
            ? '<i data-lucide="check-check" style="color:var(--secondary-color); width:18px"></i> Enviado' 
            : '<i data-lucide="clock" style="color:var(--text-secondary); width:18px"></i> Pendiente';

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
            <td><span class="status ${sc.class}">${sc.label}</span></td>
            <td style="font-size:0.85rem; font-weight:500;">
                <div style="display:flex; align-items:center; gap:0.25rem;">
                    ${wppBadge}
                </div>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn" title="Historial mensajes"><i data-lucide="message-square" style="width:18px"></i></button>
                    <button class="action-btn" title="Actualizar estado"><i data-lucide="edit-2" style="width:18px"></i></button>
                </div>
            </td>
        `;
        ordersTableBody.appendChild(tr);
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    renderRecentOrders();
    renderAllOrders();
    lucide.createIcons();
});
