// server.js - Backend ConstruFácil Pro Elite (atualizado com contingência IA e profissionais)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Modelos Gemini com fallback (5 modelos)
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'REPLACE_WITH_YOUR_KEY';
const ai = new GoogleGenAI(GEMINI_API_KEY);

// In-memory stores
let chatMessages = []; // mensagens das últimas 24h
let professionals = []; // {id, ownerId, name, trade, contact, desc, lat, lng, createdAt}

const DAY_MS = 24 * 60 * 60 * 1000;

// Limpeza automática a cada 30 min
setInterval(() => {
  const now = Date.now();
  chatMessages = chatMessages.filter(m => now - new Date(m.timestamp).getTime() < DAY_MS);
  professionals = professionals.filter(p => now - new Date(p.createdAt).getTime() < (30 * DAY_MS)); // TTL 30 dias
}, 30 * 60 * 1000);

// IA (Gemini) com contingência em 5 modelos
app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt inválido.' });
  }

  const systemInstruction = 'Você é o Consultor Técnico Elite do ConstruFácil. Responda de forma curta, direta e técnica sobre engenharia civil. Use formatação bonita.';

  let finalText = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction }
      });

      // Alguns SDKs retornam output diferente; padroniza extração
      if (response && typeof response.text === 'string' && response.text.length) {
        finalText = response.text;
      } else if (response && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        finalText = response.candidates[0].content.parts[0].text;
      }

      if (finalText) break;
    } catch (error) {
      console.error(`Falha com o modelo ${modelName}:`, error.message);
      // continua para o próximo modelo
    }
  }

  if (finalText) {
    return res.json({ text: finalText });
  }

  return res.status(502).json({
    error: 'Todos os modelos de IA falharam no momento. Tente novamente mais tarde.'
  });
});

// Profissionais: listar, cadastrar, deletar do próprio
app.get('/api/professionals', (req, res) => {
  res.json({ professionals });
});

app.post('/api/professionals', (req, res) => {
  const { ownerId, name, trade, contact, desc, lat, lng } = req.body;
  if (!ownerId || !name || !trade || !contact || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Dados inválidos para cadastro.' });
  }

  // Remove qualquer cadastro anterior do mesmo ownerId (garante um por usuário)
  professionals = professionals.filter(p => p.ownerId !== ownerId);

  const pro = {
    id: Date.now(),
    ownerId,
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

app.delete('/api/professionals/:ownerId', (req, res) => {
  const { ownerId } = req.params;
  const before = professionals.length;
  professionals = professionals.filter(p => p.ownerId !== ownerId);
  const after = professionals.length;
  res.json({ ok: true, removed: before - after });
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