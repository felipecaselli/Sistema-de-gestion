import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Initialize Google Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let db;

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

// --- 2. AI INTEGRATION (THE "MAGIC") ---
async function processMessageWithAI(messageText) {
    const systemPrompt = `Sos un asistente de recepción para un taller de restauración. Tu tarea es recibir un mensaje desestructurado y devolver ÚNICAMENTE un objeto JSON con las llaves: 'name' (Nombre del cliente), 'object' (Objeto o pieza), 'details' (Detalles de qué se necesita). Si falta alguna de esta información, devolvé un objeto con la llave 'error' pidiendo específicamente el dato faltante. IMPORTANTE: Tu respuesta debe ser solo JSON, sin formato extra ni markdown.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: messageText,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0.1
            }
        });

        const jsonStr = response.text;
        const result = JSON.parse(jsonStr);
        return result;

    } catch (error) {
        console.error("❌ Error parsing with AI:", error);
        return { error: 'Ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo.' };
    }
}

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

    const messageText = message.body;
    const senderPhone = message.from;

    console.log(`\n📩 Recibido de [${senderPhone}]: ${messageText}`);

    // Option: Show "typing..." indicator to the user
    const chat = await message.getChat();
    await chat.sendStateTyping();

    // 1. Process text with AI
    const aiResult = await processMessageWithAI(`Mensaje del cliente: "${messageText}"`);

    // 2. Decide response based on AI parsing
    let replyMessage = "";

    if (aiResult.error) {
        // Missing info -> ask the user for it
        replyMessage = aiResult.error;
    } else if (aiResult.name && aiResult.object && aiResult.details) {
        // Complete info -> Save to DB
        try {
            const dbResult = await db.run(
                `INSERT INTO orders (customer_name, phone, object_description, repair_details) 
                 VALUES (?, ?, ?, ?)`,
                [aiResult.name, senderPhone, aiResult.object, aiResult.details]
            );

            const orderId = dbResult.lastID;
            replyMessage = `¡Hola ${aiResult.name}! Tu orden para el "${aiResult.object}" ha sido registrada exitosamente con el número de seguimiento OT-${orderId}. ¡En breve te contactaremos por el presupuesto!`;

            console.log(`✅ Orden guardada: OT-${orderId}`);
        } catch (dbError) {
            console.error("❌ Database Error:", dbError);
            replyMessage = "Hubo un error al guardar tu orden. Ya lo estamos revisando.";
        }
    }

    // 3. Send response back to WhatsApp
    await message.reply(replyMessage);
    await chat.clearState();
    console.log(`📤 Enviado a [${senderPhone}]: ${replyMessage.substring(0, 30)}...`);
});

// Start the database and then initialize the WhatsApp client
setupDatabase().then(() => {
    client.initialize();
});
