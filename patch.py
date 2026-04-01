import codecs

with codecs.open('app.js', 'r', 'utf-8') as f:
    text = f.read()

# 1. Add Canvas Charts
charts_code = '''
// ==========================================
// CHARTS (Chart.js)
// ==========================================

let myRevenueChart, myStatusChart, myClientsChart;

function renderCanvasCharts(filtered) {
    const revenueCtx = document.getElementById('revenueChart');
    const statusCtx = document.getElementById('statusChart');
    const clientsCtx = document.getElementById('topClientsChart');
    
    if (!revenueCtx || !statusCtx || !clientsCtx) return;

    if (myRevenueChart) myRevenueChart.destroy();
    if (myStatusChart) myStatusChart.destroy();
    if (myClientsChart) myClientsChart.destroy();

    // 1. Line Chart: Ingresos en el tiempo
    const revDataMap = {};
    filtered.forEach(o => {
        const d = o.date;
        if(!revDataMap[d]) revDataMap[d] = 0;
        revDataMap[d] += Number(o.budget) || 0;
    });
    const revLabels = Object.keys(revDataMap).sort();
    const revData = revLabels.map(l => revDataMap[l]);

    myRevenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: revLabels.length ? revLabels : ['Sin Datos'],
            datasets: [{
                label: 'Ingresos Acumulados ($)',
                data: revLabels.length ? revData : [0],
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                fill: true,
                tension: 0.3,
                borderWidth: 2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 2. Doughnut Chart: Estados
    const statData = window.orderStatuses.map(s => filtered.filter(o => o.status === s).length);
    const statLabels = window.orderStatuses.map(s => window.statusConfig[s]?.label || s);
    
    myStatusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: statLabels,
            datasets: [{
                data: statData,
                backgroundColor: ['#64748B', '#94A3B8', '#F59E0B', '#EF4444', '#3B82F6', '#10B981'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });

    // 3. Bar Chart: Top Clientes The Best!
    const clientMap = {};
    filtered.forEach(o => {
        if(!clientMap[o.client]) clientMap[o.client] = 0;
        clientMap[o.client] += Number(o.budget) || 0;
    });
    const sortedClients = Object.entries(clientMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    
    myClientsChart = new Chart(clientsCtx, {
        type: 'bar',
        data: {
            labels: sortedClients.length ? sortedClients.map(c => c[0]) : ['N/A'],
            datasets: [{
                label: 'Volumen Monetario',
                data: sortedClients.length ? sortedClients.map(c => c[1]) : [0],
                backgroundColor: '#10B981',
                borderRadius: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}
'''
if 'renderCanvasCharts' not in text:
    text += charts_code

# 2. Fix submitOrder
old_submit1 = '''async function submitOrder() {
    const form = document.getElementById('new-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-submit').click();
        return;
    }'''
new_submit1 = '''async function submitOrder() {
    const btn = document.querySelector('button[onclick="submitOrder()"]');
    const originalText = btn ? btn.innerHTML : 'Guardar Orden';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:14px; margin-right:4px;"></i> Guardando...';
        try { lucide.createIcons(); } catch(e){}
    }

    const form = document.getElementById('new-order-form');
    if (!form.checkValidity()) {
        document.getElementById('hidden-submit').click();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            try { lucide.createIcons(); } catch(e){}
        }
        return;
    }'''
text = text.replace(old_submit1, new_submit1)

old_submit2 = '''    } catch (e) {
        console.error(e);
        alert("Error de red al guardar la orden.");
    }
}

// Close modals when clicking outside'''
new_submit2 = '''    } catch (e) {
        console.error(e);
        alert("Error de red al guardar la orden.");
    } finally {
        const btn = document.querySelector('button[onclick="submitOrder()"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Guardar Orden';
        }
    }
}

// Close modals when clicking outside'''
text = text.replace(old_submit2, new_submit2)

# 3. AI Error Fix
old_ai1 = '''    if (!response.ok) {
        throw new Error("HTTP_ERROR_" + response.status);
    }'''
new_ai1 = '''    if (!response.ok) {
        let errorMsg = "HTTP_ERROR_" + response.status;
        try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) {
                errorMsg = errData.error.message + " (Code: " + response.status + ")";
            }
        } catch(ign) {}
        throw new Error(errorMsg);
    }'''
text = text.replace(old_ai1, new_ai1)

text = text.replace('alert("Hubo un error contactando a la IA. Revisa tu consola o tu API Key.");', 'alert("Hubo un error contactando a la IA.\\nDetalle del error: " + e.message);')
text = text.replace('alert("Fallo en IA. ¿Está correcta la API Key?");', 'alert("Fallo en IA. ¿Está correcta la API Key?\\nDetalle: " + e.message);')
text = text.replace('alert("Hubo un fallo en la IA. Verifica tu conexión o tu API Key.");', 'alert("Hubo un fallo en la IA.\\nDetalle: " + e.message);')

with codecs.open('app.js', 'w', 'utf-8') as f:
    f.write(text)
print("Patched app.js successfully!")
