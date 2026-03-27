# RunCoach Pro - Guia de Configuração

## O que é

Sistema completo de coaching para meia maratona com:
- Dashboard HTML mobile-first (funciona no celular)
- Bot WhatsApp com notificações automáticas
- Registro de treinos por mensagem
- Feedback automático do coach
- Plano semanal adaptativo

---

## 1. Usar só o Dashboard (sem servidor)

Abra o arquivo `index.html` direto no celular. Funciona offline.
Você pode registrar treinos, ver o plano da semana e acompanhar sua evolução.

---

## 2. Setup Completo (Dashboard + WhatsApp)

### Pré-requisitos
- Node.js 18+ instalado
- Um servidor (VPS) com IP público OU ngrok para tunel local

### Instalação

```bash
cd coach-system
npm install
```

### Escolha o provider de WhatsApp:

---

### Opção A: Evolution API (Gratuita, Recomendada)

A Evolution API é open-source e roda no seu servidor.

1. Instale com Docker:
```bash
docker run -d \
  --name evolution \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=sua_chave_secreta \
  atendai/evolution-api:latest
```

2. Acesse `http://localhost:8080/manager` e crie uma instância chamada `runcoach`

3. Escaneie o QR Code com seu WhatsApp (igual ao WhatsApp Web)

4. Configure o webhook na Evolution API:
   - URL: `http://SEU_IP:3000/webhook/evolution`
   - Eventos: `MESSAGES_UPSERT`

5. Configure as variáveis:
```bash
export EVOLUTION_URL=http://localhost:8080
export EVOLUTION_API_KEY=sua_chave_secreta
export EVOLUTION_INSTANCE=runcoach
export WA_PROVIDER=evolution
```

6. Inicie:
```bash
npm start
```

---

### Opção B: Twilio (Pago, Mais Simples)

1. Crie conta em https://www.twilio.com
2. Ative o WhatsApp Sandbox em Console > Messaging > WhatsApp
3. Siga as instruções para conectar seu número

4. Configure:
```bash
export TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_FROM=whatsapp:+14155238886
export WA_PROVIDER=twilio
```

5. Configure webhook no Twilio:
   - URL: `https://SEU_DOMINIO/webhook/twilio`
   - Método: POST

6. Inicie:
```bash
npm start
```

---

## 3. Comandos do WhatsApp

Depois de configurar, você pode mandar mensagens assim:

| Mensagem | Ação |
|----------|------|
| `6km 35min bem` | Registra corrida de 6km |
| `8km pace 5:40 cansado gelo` | Registra com pace e recuperação |
| `plano` ou `hoje` | Recebe o treino do dia |
| `semana` ou `resumo` | Recebe resumo semanal |

---

## 4. Notificações Automáticas

O sistema envia automaticamente:

| Horário | Mensagem |
|---------|----------|
| 07:00 | Plano do dia + dica |
| 21:00 | Lembrete + treino de amanhã |
| Domingo 20:00 | Resumo semanal |

---

## 5. Expor para Internet (se rodar local)

Use ngrok para criar um túnel:

```bash
npx ngrok http 3000
```

Use a URL gerada como webhook.

---

## 6. Deploy em Produção

Opções recomendadas:
- **Railway** (railway.app) - deploy com 1 clique
- **Render** (render.com) - free tier disponível
- **VPS** (DigitalOcean, Hetzner) - para Evolution API + Server juntos

---

## Estrutura do Projeto

```
coach-system/
├── index.html          # Dashboard mobile (abre no celular)
├── server.js           # Backend Node.js + WhatsApp bot
├── package.json        # Dependências
├── coach_data.json     # Dados salvos (criado automaticamente)
└── README-SETUP.md     # Este arquivo
```
