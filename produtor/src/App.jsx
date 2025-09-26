import React, { useMemo, useState } from 'react';
import axios from "axios";
import "./App.css";

const API = "http://localhost:4000";

export default function App() {
  const [placa, setPlaca] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const placaFormatada = useMemo(() => placa.toUpperCase(), [placa]);

  const handleRequest = async (endpoint, successMessage) => {
    if (!placaFormatada) {
      setFeedback({ type: "error", message: "Informe a placa do veículo." });
      return;
    }

    const sanitizedPlate = placaFormatada.replace(/[^A-Z0-9-]/g, "");
    setIsLoading(true);
    setFeedback(null);

    try {
      const { data } = await axios.post(`${API}/${endpoint}`, { placa: sanitizedPlate });
      if (data?.ok) {
        setFeedback({ type: "success", message: successMessage });
        setPlaca("");
      }
    } catch (error) {
      const message = error?.response?.data?.error || "Não foi possível concluir a operação.";
      setFeedback({ type: "error", message });
    } finally {
      setIsLoading(false);
    }
  };

  const registrarEntrada = async (event) => {
    event.preventDefault();
    await handleRequest("entrada", "Entrada registrada com sucesso!");
  };

  const registrarSaida = async (event) => {
    event.preventDefault();
    await handleRequest("saida", "Saída registrada com sucesso!");
  };

  const handleChange = (event) => {
    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setPlaca(value.slice(0, 8));
  };

  return (
    <div className="page">
      <div className="card">
        <header className="card__header">
          <span className="card__subtitle">Operador de estacionamento</span>
          <h1 className="card__title">Registrar check-in de veículos</h1>
          <p className="card__description">
            Envie eventos de entrada ou saída para o RabbitMQ. Os painéis conectados serão atualizados em tempo real
            via WebSocket.
          </p>
        </header>

        <form className="form" onSubmit={registrarEntrada}>
          <label className="form__label" htmlFor="placa">Placa do veículo</label>
          <div className="form__control">
            <input
              id="placa"
              className="form__input"
              value={placa}
              onChange={handleChange}
              placeholder="ABC1D23"
              autoComplete="off"
              maxLength={8}
              disabled={isLoading}
            />
          </div>

          {feedback && (
            <div className={`feedback feedback--${feedback.type}`} role="status" aria-live="polite">
              {feedback.message}
            </div>
          )}

          <div className="form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isLoading || !placaFormatada}
            >
              {isLoading ? "Processando..." : "Registrar entrada"}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={registrarSaida}
              disabled={isLoading || !placaFormatada}
            >
              Registrar saída
            </button>
          </div>
        </form>

        <footer className="card__footer">
          Os eventos são publicados com as routing keys <strong>parking.entry</strong> e <strong>parking.exit</strong> no
          exchange <strong>parking</strong>.
        </footer>
      </div>
    </div>
  );
}
