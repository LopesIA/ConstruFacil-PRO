// server.js - Backend ConstruFácil Pro Elite (CORRIGIDO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Lista de modelos Gemini para fallback: tenta o mais rápido/acessível primeiro.
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-flash', 
    'gemini-1.5-pro', 
    'gemini-pro' 
];

// Configuração de CORS para Express (API /api/gemini)
// Ajustamos para listar o seu domínio explicitamente.
const allowedOrigins = ['https://constru.novaversao.site', 'http://localhost:3000']; 
app.use(cors({
    origin: allowedOrigins
}));

// Configuração do Socket.io para aceitar conexões do celular/navegador
// O Socket.io aceita "*" para permitir qualquer cliente WebSocket.
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const PORT = 3000;

// >>> COLOQUE SUA CHAVE AQUI <<<
// Certifique-se de que a variável GEMINI_API_KEY está configurada no Render!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyA1zStCx3m5-XoOanUgqfuYz7XxKlA8xVA'; 
const ai = new GoogleGenAI(GEMINI_API_KEY);

// Middlewares
app.use(express.json());

// --- Rota da IA (Gemini) ---
app.post('/api/gemini', async (req, res) => {
    const { prompt } = req.body;
    
    // Instrução para a IA agir como especialista
    const systemInstruction = `Você é o Consultor Técnico Elite do ConstruFácil. Responda de forma curta, direta e técnica sobre engenharia civil. Use formatação bonita.`;

    let finalResponse = null;
    let successfulModel = null;
    
    // Loop de tentativas com os modelos
    for (const modelName of GEMINI_MODELS) {
        console.log(`Tentando modelo: ${modelName}`);
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: { systemInstruction: systemInstruction }
            });

            // Se chegou aqui, a chamada foi bem-sucedida
            finalResponse = response;
            successfulModel = modelName;
            console.log(`Sucesso com o modelo: ${modelName}`);
            break; // Sai do loop
            
        } catch (error) {
            // Se falhou, registra o erro e tenta o próximo modelo
            console.error(`Falha com o modelo ${modelName}:`, error.message);
            // Continua para a próxima iteração do loop
        }
    }

    if (finalResponse) {
        // CORREÇÃO CRÍTICA: response.text é uma PROPRIEDADE, não uma FUNÇÃO.
        const text = finalResponse.text ? finalResponse.text : `Sem resposta da IA. (Modelo: ${successfulModel})`;
        res.json({ text: text });
    } else {
        // Se o loop terminou e não houve sucesso em nenhum modelo
        console.error("ERRO CRÍTICO: Todos os modelos Gemini falharam na execução.");
        res.status(500).json({ error: "O Consultor Técnico está indisponível. Falha em todos os modelos de IA. Verifique as variáveis de ambiente e a chave API." });
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

        // Broadcast para todos os clientes conectados
        io.emit('new_message', msg);
    });
    
    socket.on('disconnect', () => {
        console.log(`📴 Dispositivo desconectado: ${socket.id}`);
    });
});

// Inicialização do Servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor Elite rodando em: http://localhost:${PORT}`);
});