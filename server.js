// server.js - Backend ConstruFácil Pro Elite (atualizado)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Modelos Gemini com fallback
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

// CORS para APIs
const allowedOrigins = [
  'https://constru.novaversao.site',
  'https://construfacilpro.novaversao.site',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Socket.io (libera WS amplo)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyA1zStCx3m5-XoOanUgqfuYz7XxKlA8xVA';
const ai = new GoogleGenAI(GEMINI_API_KEY);

// In-memory stores
let chatMessages = []; // mensagens das últimas 24h
let professionals = []; // lista de profissionais {id, name, trade, contact, desc, lat, lng, createdAt}

const DAY_MS = 24 * 60 * 60 * 1000;

// Limpeza automática a cada 30 min
setInterval(() => {
  const now = Date.now();
  chatMessages = chatMessages.filter(m => now - new Date(m.timestamp).getTime() < DAY_MS);
  professionals = professionals.filter(p => now - new Date(p.createdAt).getTime() < (30 * DAY_MS)); // TTL 30 dias
}, 30 * 60 * 1000);

// IA (Gemini)
app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;
  const systemInstruction = 'Você é o Consultor Técnico Elite do ConstruFácil. Responda de forma curta, direta e técnica sobre engenharia civil. Use formatação bonita.';

  let finalResponse = null;
  let successfulModel = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction }
      });
      finalResponse = response;
      successfulModel = modelName;
      break;
    } catch (error) {
      console.error(`Falha com o modelo ${modelName}:`, error.message);
    }
  }

  if (finalResponse) {
    const text = finalResponse.text ? finalResponse.text : `Sem resposta da IA. (Modelo: ${successfulModel})`;
    res.json({ text });
  } else {
    res.status(500).json({ error: 'O Consultor Técnico está indisponível no momento.' });
  }
});

// Profissionais: listar e cadastrar
app.get('/api/professionals', (req, res) => {
  res.json({ professionals });
});

app.post('/api/professionals', (req, res) => {
  const { name, trade, contact, desc, lat, lng } = req.body;
  if (!name || !trade || !contact || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Dados inválidos para cadastro.' });
  }

  const pro = {
    id: Date.now(),
    name,
    trade,
    contact,
    desc: desc || '',
    lat,
    lng,
    createdAt: new Date().toISOString()
  };
  professionals.push(pro);
  res.json({ ok: true, professional: pro });
});

// Chat realtime
io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);

  // envia histórico atual
  socket.emit('chat_history', chatMessages);

  socket.on('send_message', (data) => {
    const msg = {
      id: Date.now(),
      nickname: data.nickname || 'Anônimo',
      content: data.content,
      timestamp: new Date(),
      isUser: false
    };

    chatMessages.push(msg);
    // mantém até ~50-100 na memória para reduzir payload
    if (chatMessages.length > 100) chatMessages = chatMessages.slice(-100);

    io.emit('new_message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`📴 Desconectado: ${socket.id}`);
  });
});

// Server init
server.listen(PORT, () => {
  console.log(`🚀 Servidor Elite rodando em: http://localhost:${PORT}`);
});