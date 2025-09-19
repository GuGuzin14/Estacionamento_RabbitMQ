# Servidor - Estacionamento com RabbitMQ

Este servidor expõe APIs REST para registrar entrada/saída de veículos e publica eventos no RabbitMQ. Também consome os eventos e emite atualizações em tempo real via WebSocket (Socket.IO) para o painel.

## Endpoints
- `POST /entrada` body: `{ "placa": "ABC1234" }`
- `POST /saida` body: `{ "placa": "ABC1234" }`
- `GET /status` retorna `{ capacity, occupied, free }`

## Variáveis (.env)
```
RABBIT_URL=amqp://guest:guest@localhost:5672
EXCHANGE=parking
QUEUE=parking_queue
CAPACITY=50
PORT=4000
```

## Rodando
1. Suba o RabbitMQ local (porta 5672 e 15672 opcional para UI).
2. Instale dependências:
```powershell
cd "c:\Users\Aluno\Downloads\Mensageria - RabbitMQ\servidor"; npm install
```
3. Inicie:
```powershell
npm start
```

---

Os eventos publicados usam routing keys `parking.entry` e `parking.exit` no exchange topic `parking`.
