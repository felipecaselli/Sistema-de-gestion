import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config();

let db;
// Dictionary to keep track of user sessions and their current step in the menu
const sessions = {};

// --- 1. SETUP DATABASE ---
async function setupDatabase() {
    db = await open({
        filename: './craftflow.db', // SQLite database file
        driver: sqlite3.Database
    });

    // Create the orders table automatically if it doesn't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            object_description TEXT NOT NULL,
            repair_details TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("✅ Database initialized");
}

// --- 2. MENU STATE LOGIC ---
// We use the sessions object above to keep track of steps.
// Available Steps:
// - AWAITING_NAME
// - AWAITING_OBJECT
// - AWAITING_DETAILS

// --- 3. WHATSAPP CLIENT SETUP ---
// We use LocalAuth so you ONLY scan the QR code the FIRST time.
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Generate QR Code dynamically
client.on('qr', (qr) => {
    console.log('📱 Escanea este código QR con tu aplicación de WhatsApp (Configuración > Dispositivos Vinculados):');
    qrcode.generate(qr, { small: true });
});

// Ready Event
client.on('ready', () => {
    console.log('✅ WhatsApp Bot conectado exitosamente. Escuchando nuevos mensajes...');
});

// Authentication events for Logging
client.on('authenticated', () => {
    console.log('✅ Autenticado correctamente con los servidores de WhatsApp.');
});

client.on('auth_failure', msg => {
    console.error('❌ Error de autenticación:', msg);
});

// --- 4. MESSAGE RECEPTION & LOGIC ---
client.on('message', async (message) => {
    // Prevent the bot from replying to itself, status messages, or group chats
    if (message.fromMe || message.isStatus || message.isGroup) return;

    const messageText = message.body.trim();
    const senderPhone = message.from;

    console.log(`\n📩 Recibido de [${senderPhone}]: ${messageText}`);

    // Show "typing..." indicator to the user
    const chat = await message.getChat();
    await chat.sendStateTyping();

    // Menu State Machine Logic
    if (!sessions[senderPhone]) {
        // Start new conversation / order process
        sessions[senderPhone] = { step: 'AWAITING_NAME' };
        await message.reply("¡Hola! Bienvenido al taller de restauración. Para registrar tu orden, necesito que me pases algunos datos.\n\nPor favor, decime tu *Nombre Completo*:");
        console.log(`🤖 Solicitando Nombre a [${senderPhone}]`);
    } else {
        const session = sessions[senderPhone];
        
        switch (session.step) {
            case 'AWAITING_NAME':
                session.name = messageText;
                session.step = 'AWAITING_OBJECT';
                await message.reply(`¡Perfecto, ${session.name}! ¿Qué *objeto o pieza* necesitas restaurar?`);
                console.log(`🤖 Solicitando Objeto a [${senderPhone}]`);
                break;
                
            case 'AWAITING_OBJECT':
                session.object = messageText;
                session.step = 'AWAITING_DETAILS';
                await message.reply(`Entendido. Por último, contame, ¿qué *detalles* o tipo de reparación necesita el objeto?`);
                console.log(`🤖 Solicitando Detalles a [${senderPhone}]`);
                break;
                
            case 'AWAITING_DETAILS':
                session.details = messageText;
                
                // Save to database
                try {
                    const dbResult = await db.run(
                        `INSERT INTO orders (customer_name, phone, object_description, repair_details) 
                         VALUES (?, ?, ?, ?)`,
                        [session.name, senderPhone, session.object, session.details]
                    );

                    const orderId = dbResult.lastID;
                    await message.reply(`¡Excelente ${session.name}!\n\nTu orden para la restauración de "${session.object}" ha sido registrada exitosamente con el número de seguimiento *OT-${orderId}*.\n\n¡En breve un humano te contactará por el presupuesto!`);
                    console.log(`✅ Orden guardada en DB: OT-${orderId}`);
                } catch (dbError) {
                    console.error("❌ Database Error:", dbError);
                    await message.reply("Hubo un error al guardar tu orden. Por favor intenta enviando cualquier mensaje para reiniciar.");
                }
                
                // Clear session so the user can start over in the future
                delete sessions[senderPhone];
                break;
        }
    }

    await chat.clearState();
});

// Start the database and then initialize the WhatsApp client
setupDatabase().then(() => {
    client.initialize();
});
