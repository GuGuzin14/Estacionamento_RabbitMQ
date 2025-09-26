import React, { useEffect, useMemo, useState } from 'react';
import { io } from "socket.io-client";
import axios from "axios";
import "./App.css";

const API = "http://localhost:4000";

export default function App() {
  const [status, setStatus] = useState({ capacity: 0, occupied: 0, free: 0 });
  const [eventos, setEventos] = useState([]);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    axios.get(`${API}/status`).then(({ data }) => setStatus(data)).catch(() => {});

    const socket = io(API, { transports: ["websocket"] });
    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));
    socket.on("parking.update", (msg) => {
      const { capacity, occupied, free, lastEvent } = msg;
      setStatus({ capacity, occupied, free });
      if (lastEvent) {
        setEventos((prev) => [lastEvent, ...prev].slice(0, 50));
      }
    });

    return () => socket.disconnect();
  }, []);

  const occupancyPercent = useMemo(() => {
    if (!status.capacity) return 0;
    return Math.min(100, Math.round((status.occupied / status.capacity) * 100));
  }, [status]);

  const connectionLabel = conectado ? "Conectado" : "Reconectando...";

  return (
    <div className="page">
      <main className="dashboard">
        <header className="dashboard__header">
          <div>
            <p className="dashboard__eyebrow">Monitoramento em tempo real</p>
            <h1 className="dashboard__title">Painel de vagas do estacionamento</h1>
            <p className="dashboard__subtitle">
              Acompanhe a ocupação e os eventos disparados pelo produtor via RabbitMQ. Tudo é propagado usando Socket.IO.
            </p>
          </div>
          <span className={`status-badge status-badge--${conectado ? "online" : "offline"}`}>
            <span className="status-badge__dot" aria-hidden />
            {connectionLabel}
          </span>
        </header>

        <section className="metrics" aria-label="Indicadores do estacionamento">
          <MetricCard
            title="Capacidade"
            value={status.capacity}
            subtitle="Vagas totais disponíveis"
            variant="neutral"
          />
          <MetricCard
            title="Ocupadas"
            value={status.occupied}
            subtitle="Veículos atualmente estacionados"
            variant="warning"
          />
          <MetricCard
            title="Livres"
            value={status.free}
            subtitle="Vagas prontas para novos veículos"
            variant="success"
          />
        </section>

        <section className="occupancy" aria-label="Taxa de ocupação">
          <div className="occupancy__header">
            <h2>Taxa de ocupação</h2>
            <span className="occupancy__tag">{occupancyPercent}% ocupado</span>
          </div>
          <div className="occupancy__progress">
            <div className="occupancy__bar" style={{ width: `${occupancyPercent}%` }} />
          </div>
          <p className="occupancy__note">
            Baseado em {status.occupied} veículos dentro de um total de {status.capacity} vagas monitoradas.
          </p>
        </section>

        <section className="events" aria-live="polite" aria-label="Últimos eventos registrados">
          <div className="events__header">
            <h2>Últimos eventos</h2>
            <span className="events__counter">{eventos.length} registrados</span>
          </div>
          {eventos.length === 0 ? (
            <div className="events__empty">
              <p>Nenhum evento ainda. Assim que o operador registrar uma entrada ou saída, ele aparecerá aqui.</p>
            </div>
          ) : (
            <ul className="event-list">
              {eventos.map((evento) => (
                <EventItem key={`${evento.ts}-${evento.plate}-${evento.type}`} evento={evento} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ title, value, subtitle, variant = "neutral" }) {
  return (
    <article className={`metric metric--${variant}`}>
      <p className="metric__title">{title}</p>
      <p className="metric__value">{value}</p>
      <p className="metric__subtitle">{subtitle}</p>
    </article>
  );
}

function EventItem({ evento }) {
  const isEntry = evento.type === "entry";
  const timestamp = new Date(evento.ts);
  const formattedTime = `${timestamp.toLocaleDateString()} • ${timestamp.toLocaleTimeString()}`;

  return (
    <li className="event-item">
      <span className={`event-item__icon event-item__icon--${isEntry ? "entry" : "exit"}`} aria-hidden>
        {isEntry ? "➜" : "⬅"}
      </span>
      <div className="event-item__content">
        <p className="event-item__title">
          {isEntry ? "Entrada registrada" : "Saída registrada"}
          <span className={`event-item__badge event-item__badge--${isEntry ? "entry" : "exit"}`}>
            {isEntry ? "Entrada" : "Saída"}
          </span>
        </p>
        <p className="event-item__meta">
          Placa <strong>{evento.plate}</strong> · {formattedTime}
        </p>
      </div>
    </li>
  );
}
