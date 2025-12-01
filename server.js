// server.js - Backend ConstruFácil Pro Elite
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.io para aceitar conexões do celular/navegador
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const PORT = 3000;

// >>> COLOQUE SUA CHAVE AQUI <<<
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyA1zStCx3m5-XoOanUgqfuYz7XxKlA8xVA'; 
const ai = new GoogleGenAI(GEMINI_API_KEY);

// Middlewares
app.use(cors());
app.use(express.json());

// --- Rota da IA (Gemini) ---
app.post('/api/gemini', async (req, res) => {
    const { prompt } = req.body;
    
    // Instrução para a IA agir como especialista
    const systemInstruction = `Você é o Consultor Técnico Elite do ConstruFácil. Responda de forma curta, direta e técnica sobre engenharia civil. Use formatação bonita.`;

    try {
        // Tenta usar o modelo mais rápido primeiro
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { systemInstruction: systemInstruction }
        });
        
        // Extrai o texto da resposta (tratamento de erro básico)
        const text = response.text ? response.text() : "Sem resposta da IA.";
        res.json({ text: text });

    } catch (error) {
        console.error("Erro na IA:", error);
        res.status(500).json({ error: "O Consultor Técnico está offline no momento." });
    }
});

// --- Chat em Tempo Real ---
let chatMessages = []; // Histórico em memória

io.on('connection', (socket) => {
    console.log(`🔌 Novo dispositivo conectado: ${socket.id}`);
    
    // Envia histórico ao conectar
    socket.emit('chat_history', chatMessages);

    socket.on('send_message', (data) => {
        // Data espera: { nickname, content, avatar (opcional) }
        const msg = {
            id: Date.now(),
            nickname: data.nickname || 'Anônimo',
            content: data.content,
            timestamp: new Date(),
            isUser: false // Flag para identificar no frontend depois
        };
        
        // Guarda apenas as últimas 50 mensagens
        if(chatMessages.length > 50) chatMessages.shift();
        chatMessages.push(msg);

        io.emit('receive_message', msg);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor Elite rodando em: http://localhost:${PORT}`);
});