import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// --- 1. SETUP EXPRESS & SUPABASE ---
const app = express();
app.use(cors());
app.use(express.json());

// If not provided in .env yet, use placeholders
const supabaseUrl = process.env.SUPABASE_URL || 'REEMPLAZAR_CON_TU_URL';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'REEMPLAZAR_CON_TU_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Hardcoded tenant ID for MVP
const DEFAULT_TENANT_ID = 'taller-demo';

// --- API ENDPOINTS ---
// GET Orders
app.get('/api/orders', async (req, res) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST Order (from Dashboard)
app.post('/api/orders', async (req, res) => {
    const newOrder = { ...req.body, tenant_id: DEFAULT_TENANT_ID };
    const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select()
        .single();
        
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH Order Status
app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', req.params.id)
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// DELETE Order
app.delete('/api/orders/:id', async (req, res) => {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', req.params.id)
        .eq('tenant_id', DEFAULT_TENANT_ID);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- 2. START EXPRESS SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API (Express) corriendo en el puerto ${PORT}`);
});

// --- 3. WHATSAPP CLIENT SETUP ---
const sessions = {};
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('📱 Escanea este código QR con tu aplicación de WhatsApp (Configuración > Dispositivos Vinculados):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp Bot conectado exitosamente. Escuchando mensajes...');
});

// --- 4. MESSAGE RECEPTION & LOGIC ---
client.on('message', async (message) => {
    if (message.fromMe || message.isStatus || message.isGroup) return;

    const messageText = message.body.trim();
    const senderPhone = message.from;

    const chat = await message.getChat();
    await chat.sendStateTyping();

    if (!sessions[senderPhone]) {
        sessions[senderPhone] = { step: 'MENU_PRINCIPAL' };
        await message.reply("¡Hola! Soy el asistente virtual del taller 🛠️.\n\nPor favor responde con el *número* de la opción deseada:\n1️⃣ Solicitar un trabajo / presupuesto\n2️⃣ Consultar estado de una reparación\n3️⃣ Hablar con un humano");
    } else {
        const session = sessions[senderPhone];
        
        switch (session.step) {
            case 'MENU_PRINCIPAL':
                if (messageText === '1') {
                    session.step = 'AWAITING_NAME';
                    await message.reply("Excelente. Por favor, escribí en *un solo mensaje* tu *Nombre y Apellido*:");
                } else if (messageText === '2') {
                    session.step = 'AWAITING_TRACKING';
                    await message.reply("Por favor, ingresa tu código de seguimiento (ej: OT-1234abcd o simplemente los números/letras extrayendo el OT-):");
                } else if (messageText === '3') {
                    session.step = 'HUMAN_MODE';
                    await message.reply("Un representante se contactará contigo a la brevedad. ¡Gracias por comunicarte! (Envía *reiniciar* en cualquier momento para volver al menú automático).");
                } else {
                    await message.reply("Opción no válida. Por favor responde únicamente con *1*, *2* o *3*.");
                }
                break;

            case 'AWAITING_NAME':
                session.name = messageText;
                session.step = 'AWAITING_OBJECT';
                await message.reply(`Gracias *${session.name}*. Ahora selecciona qué *tipo de servicio* o elemento requieres (responde con el número):\n\n1. Chapa y Pintura / Reparación de carrocería\n2. Mecánica / Motor\n3. Service General / Mantenimiento\n4. Otro`);
                break;
                
            case 'AWAITING_OBJECT':
                const options = {
                    '1': 'Chapa y Pintura / Reparación de carrocería',
                    '2': 'Mecánica / Motor',
                    '3': 'Service General / Mantenimiento',
                    '4': 'Otro'
                };
                if (options[messageText]) {
                    session.object = options[messageText];
                    session.step = 'AWAITING_DETAILS';
                    await message.reply(`Perfecto. Por último, descríbeme brevemente cuál es el problema o qué necesitas (ej: "hace ruido al frenar", o "cambio de aceite"):`);
                } else {
                    await message.reply("Por favor, elige una opción válida del *1 al 4*.");
                }
                break;
                
            case 'AWAITING_DETAILS':
                session.details = messageText;
                
                // Limpiar el número de teléfono para la base de datos (+549 y @c.us)
                let dbCleanPhone = senderPhone.replace(/@c\.us/g, '').replace(/@g\.us/g, '');
                if (dbCleanPhone.startsWith('549')) dbCleanPhone = dbCleanPhone.substring(3);
                if (dbCleanPhone.startsWith('54')) dbCleanPhone = dbCleanPhone.substring(2);

                // Save to Supabase
                const { data: insertData, error: insertError } = await supabase
                    .from('orders')
                    .insert([{
                        tenant_id: DEFAULT_TENANT_ID,
                        client_name: session.name,
                        contact_phone: dbCleanPhone,
                        object_name: session.object,
                        service_details: session.details,
                        status: 'recibido',
                        wpp_status: 'pending' // pending manual notification
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error("❌ Error Supabase:", insertError);
                    await message.reply("Hubo un error al guardar tu orden. Por favor envía cualquier mensaje para reiniciar el menú.");
                } else {
                    const trackingId = insertData.id.toString().substring(0, 8); // Shortened ID for tracking
                    await message.reply(`¡Orden registrada con éxito!\n\nTu número de seguimiento es *OT-${trackingId}*.\n\nEn breve un humano revisará los detalles para armar tu presupuesto.`);
                    console.log(`✅ Orden guardada en DB: OT-${trackingId}`);
                }
                
                delete sessions[senderPhone];
                break;

            case 'AWAITING_TRACKING':
                const match = messageText.match(/([a-zA-Z0-9\-]+)/);
                if (!match) {
                    await message.reply("Por favor, ingresa un código de seguimiento válido.");
                    break;
                }
                const trackingInput = match[1].replace('OT-', '').trim();
                
                try {
                    const { data: searchData, error: searchError } = await supabase
                        .from('orders')
                        .select('id, status, object_name')
                        .eq('tenant_id', DEFAULT_TENANT_ID);
                        
                    if (searchError) throw searchError;
                    
                    const foundOrder = searchData.find(o => o.id.toString().substring(0, 8) === trackingInput.substring(0, 8));
                    
                    if (foundOrder) {
                        const statusMap = {
                            recibido: "Recibido (esperando diagnóstico)",
                            proceso: "En Proceso",
                            materiales: "En Espera de Materiales",
                            listo: "Listo para Entrega"
                        };
                        const readableStatus = statusMap[foundOrder.status] || foundOrder.status;
                        await message.reply(`Tu reparación para *${foundOrder.object_name}* se encuentra actualmente: *${readableStatus}*.\n\n¡Gracias por consultar!`);
                    } else {
                        await message.reply(`No encontramos ninguna orden con el código *${trackingInput}*. Por favor verifica y vuelve a intentar enviando el código.`);
                        // Mantenemos la sesión para que vuelva a introducir el código, o podemos borrarla para que regrese al menú
                    }
                } catch (err) {
                    console.error("Error buscando orden", err);
                    await message.reply("Hubo un error al buscar tu orden. Por favor intenta de nuevo más tarde.");
                }
                
                delete sessions[senderPhone];
                break;

            case 'HUMAN_MODE':
                if (messageText.toLowerCase() === 'reiniciar') {
                    delete sessions[senderPhone];
                    await message.reply("🤖 Menú automático reiniciado. Envía un mensaje (ej: Hola) para empezar.");
                }
                // Si no es "reiniciar", no hace nada y deja hablar al humano.
                break;
        }
    }

    await chat.clearState();
});

// START
client.initialize();
