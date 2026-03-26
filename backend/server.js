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
        sessions[senderPhone] = { step: 'AWAITING_NAME' };
        await message.reply("¡Hola! Bienvenido al taller. Para registrar tu orden, necesito que me pases algunos datos.\n\nPor favor, decime tu *Nombre Completo*:");
    } else {
        const session = sessions[senderPhone];
        
        switch (session.step) {
            case 'AWAITING_NAME':
                session.name = messageText;
                session.step = 'AWAITING_OBJECT';
                await message.reply(`¡Perfecto, ${session.name}! ¿Qué *objeto o pieza* necesitas restaurar?`);
                break;
                
            case 'AWAITING_OBJECT':
                session.object = messageText;
                session.step = 'AWAITING_DETAILS';
                await message.reply(`Entendido. Por último, contame, ¿qué *detalles* o tipo de reparación necesita el objeto?`);
                break;
                
            case 'AWAITING_DETAILS':
                session.details = messageText;
                
                // Save to Supabase
                const { data, error } = await supabase
                    .from('orders')
                    .insert([{
                        tenant_id: DEFAULT_TENANT_ID,
                        client_name: session.name,
                        contact_phone: senderPhone,
                        object_name: session.object,
                        service_details: session.details,
                        status: 'recibido',
                        wpp_status: 'pending' // pending manual notification
                    }])
                    .select()
                    .single();

                if (error) {
                    console.error("❌ Error Supabase:", error);
                    await message.reply("Hubo un error al guardar tu orden. Por favor intenta enviando cualquier mensaje para reiniciar.");
                } else {
                    const trackingId = data.id.toString().substring(0, 8); // Shortened ID for tracking
                    await message.reply(`¡Excelente ${session.name}!\n\nTu orden para la restauración de "${session.object}" ha sido registrada exitosamente con el número de seguimiento *OT-${trackingId}*.\n\n¡En breve un humano te contactará por el presupuesto!`);
                    console.log(`✅ Orden guardada en DB: OT-${trackingId}`);
                }
                
                delete sessions[senderPhone];
                break;
        }
    }

    await chat.clearState();
});

// START
client.initialize();
