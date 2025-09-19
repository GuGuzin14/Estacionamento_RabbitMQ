import React, { useState } from 'react';
import axios from "axios";

const API = "http://localhost:4000";

export default function App() {
  const [placa, setPlaca] = useState("");

  const registrarEntrada = async (e) => {
    e.preventDefault();
    if (!placa) return alert("Informe a placa do veículo");
    try {
      const { data } = await axios.post(`${API}/entrada`, { placa });
      if (data?.ok) {
        alert("Entrada registrada!");
        setPlaca("");
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  const registrarSaida = async (e) => {
    e.preventDefault();
    if (!placa) return alert("Informe a placa do veículo");
    try {
      const { data } = await axios.post(`${API}/saida`, { placa });
      if (data?.ok) {
        alert("Saída registrada!");
        setPlaca("");
      }
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Controle de Estacionamento - Operador</h2>
      <form style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <label>Placa do veículo</label>
        <input value={placa} onChange={e=>setPlaca(e.target.value.toUpperCase())} placeholder="ABC1234" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={registrarEntrada}>Registrar entrada</button>
          <button onClick={registrarSaida} type="button">Registrar saída</button>
        </div>
      </form>
      <p style={{ marginTop: 16, color: '#666' }}>As ações publicam eventos no RabbitMQ (parking.entry / parking.exit).</p>
    </div>
  );
}
