require('dotenv').config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const amqp = require("amqplib");
const { Server } = require("socket.io");

// Variáveis de ambiente
const RABBIT_URL = process.env.RABBIT_URL;      // URL do broker RabbitMQ
const EXCHANGE = process.env.EXCHANGE || "parking"; // exchange topic
const QUEUE = process.env.QUEUE || "parking_queue"; // fila persistente
const CAPACITY = parseInt(process.env.CAPACITY || "50", 10); // capacidade total de vagas

async function start() {
  // 1) Conexão com RabbitMQ
  const conn = await amqp.connect(RABBIT_URL);
  const channel = await conn.createChannel();

  // 2) Exchange e fila (topic, durável)
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true, exclusive: false, autoDelete: false });
  // Routing keys aceitas: parking.entry e parking.exit
  await channel.bindQueue(QUEUE, EXCHANGE, "parking.*");

  // 3) Servidor HTTP + WebSocket
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  // Estado em memória (apenas para demo)
  const vehiclesInside = new Set(); // placas dentro
  function getStatus() {
    const occupied = vehiclesInside.size;
    const free = Math.max(0, CAPACITY - occupied);
    return { capacity: CAPACITY, occupied, free };
  }

  // Helper para publicar eventos de estacionamento
  function publishParkingEvent(type, plate) {
    const routingKey = `parking.${type}`; // entry | exit
    const payload = { type, plate, ts: Date.now() };
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: "application/json" }
    );
  }

  // 4) Endpoints REST do produtor
  app.post("/entrada", (req, res) => {
    const { placa } = req.body || {};
    if (!placa || typeof placa !== "string") {
      return res.status(400).json({ error: "Campo 'placa' é obrigatório." });
    }
    const { free } = getStatus();
    if (free <= 0) {
      return res.status(409).json({ error: "Estacionamento lotado." });
    }
    if (vehiclesInside.has(placa)) {
      return res.status(409).json({ error: "Veículo já está no estacionamento." });
    }
    publishParkingEvent("entry", placa);
    return res.json({ ok: true });
  });

  app.post("/saida", (req, res) => {
    const { placa } = req.body || {};
    if (!placa || typeof placa !== "string") {
      return res.status(400).json({ error: "Campo 'placa' é obrigatório." });
    }
    if (!vehiclesInside.has(placa)) {
      return res.status(404).json({ error: "Veículo não está no estacionamento." });
    }
    publishParkingEvent("exit", placa);
    return res.json({ ok: true });
  });

  // 5) Endpoint para status atual
  app.get("/status", (_req, res) => {
    return res.json(getStatus());
  });

  // 6) Consumo condicionado da fila
  let connectedClients = 0;
  let consumerTag = null;

  async function startConsuming() {
    if (consumerTag) return;
    const { consumerTag: tag } = await channel.consume(
      QUEUE,
      (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());
          const { type, plate } = data || {};

          let changed = false;
          if (type === "entry") {
            if (!vehiclesInside.has(plate) && vehiclesInside.size < CAPACITY) {
              vehiclesInside.add(plate);
              changed = true;
            }
          } else if (type === "exit") {
            if (vehiclesInside.has(plate)) {
              vehiclesInside.delete(plate);
              changed = true;
            }
          }

          if (changed) {
            const status = getStatus();
            io.sockets.emit("parking.update", { ...status, lastEvent: data });
          }

          channel.ack(msg);
        } catch (e) {
          console.error("[RabbitMQ] Erro ao processar mensagem:", e);
          // NACK sem requeue para evitar loop infinito em mensagem inválida
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
    consumerTag = tag;
    console.log("[RabbitMQ] Consumo iniciado");
  }

  async function stopConsuming() {
    if (!consumerTag) return;
    await channel.cancel(consumerTag);
    consumerTag = null;
    console.log("[RabbitMQ] Consumo parado (sem clientes conectados)");
  }

  // 7) WebSocket: inicia/para consumo conforme clientes
  io.on("connection", (socket) => {
    connectedClients += 1;
    console.log(`[Socket] Cliente conectado (${connectedClients} ativo(s))`);

    // Envia status inicial ao cliente recém-conectado
    socket.emit("parking.update", { ...getStatus(), lastEvent: null });

    if (connectedClients === 1) startConsuming();

    socket.on("disconnect", () => {
      connectedClients -= 1;
      console.log(`[Socket] Cliente desconectado (${connectedClients} ativo(s))`);
      if (connectedClients <= 0) stopConsuming();
    });
  });

  // 8) Sobe servidor HTTP
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`[RabbitMQ] Exchange '${EXCHANGE}' | Queue '${QUEUE}' | Capacity ${CAPACITY}`);
  });
}

// Bootstrap
start().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
