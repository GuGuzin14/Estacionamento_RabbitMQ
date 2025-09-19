import React, { useEffect, useRef, useState } from 'react';
import { io } from "socket.io-client";
import axios from "axios";

const API = "http://localhost:4000";

export default function App() {
  const [status, setStatus] = useState({ capacity: 0, occupied: 0, free: 0 });
  const [eventos, setEventos] = useState([]);
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // buscar status inicial via HTTP
    axios.get(`${API}/status`).then(({ data }) => setStatus(data)).catch(() => {});

    // conectar socket
    const socket = io(API, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));
    socket.on("parking.update", (msg) => {
      const { capacity, occupied, free, lastEvent } = msg;
      setStatus({ capacity, occupied, free });
      if (lastEvent) setEventos((prev) => [lastEvent, ...prev].slice(0, 50));
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Painel de Vagas - Tempo Real {conectado ? '🟢' : '🔴'}</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <Card title="Capacidade" value={status.capacity} color="#888" />
        <Card title="Ocupadas" value={status.occupied} color="#e74c3c" />
        <Card title="Livres" value={status.free} color="#2ecc71" />
      </div>

      <h3 style={{ marginTop: 24 }}>Últimos eventos</h3>
      {eventos.length === 0 ? (
        <p>Nenhum evento ainda.</p>
      ) : (
        <ul>
          {eventos.map((e, i) => (
            <li key={i}>
              [{new Date(e.ts).toLocaleTimeString()}] {e.type === 'entry' ? 'Entrada' : 'Saída'} - Placa {e.plate}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <div style={{ border: `2px solid ${color}`, padding: 12, borderRadius: 8, minWidth: 160 }}>
      <div style={{ color, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 28 }}>{value}</div>
    </div>
  );
}
