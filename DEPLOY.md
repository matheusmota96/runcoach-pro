# RunCoach Pro - Deploy no Railway

## Passo a Passo (10 minutos)

### 1. Criar conta no Railway
- Acesse https://railway.com e entre com sua conta GitHub

### 2. Subir o projeto no GitHub
No terminal do seu computador:
```bash
cd coach-system
git init
git add .
git commit -m "RunCoach Pro - initial deploy"
```
Crie um repositorio no GitHub (https://github.com/new) e suba:
```bash
git remote add origin https://github.com/SEU_USUARIO/runcoach-pro.git
git branch -M main
git push -u origin main
```

### 3. Deploy no Railway
1. No Railway, clique em **New Project**
2. Selecione **Deploy from GitHub repo**
3. Escolha o repositorio `runcoach-pro`
4. Railway detecta automaticamente o Node.js e faz o deploy

### 4. Adicionar Volume para persistir dados
**IMPORTANTE** - Sem volume, os dados se perdem quando o servidor reinicia!

1. No dashboard do Railway, clique no servico
2. Va em **Settings** > **Volumes**
3. Clique em **Add Volume**
4. Mount path: `/data`
5. Na aba **Variables**, adicione:
   - `DATA_DIR` = `/data`
   - `PORT` = `3000` (Railway define automaticamente, mas garante)

### 5. Gerar URL publica
1. Va em **Settings** > **Networking**
2. Clique em **Generate Domain**
3. Voce recebe uma URL tipo: `runcoach-pro-production.up.railway.app`

### 6. Acessar no celular
1. Abra a URL no navegador do celular
2. No iPhone: Safari > Compartilhar > Adicionar a Tela de Inicio
3. No Android: Chrome > Menu > Adicionar a tela inicial
4. Pronto! O app funciona como app nativo

## Variaveis de Ambiente (Opcionais)

Para WhatsApp via Evolution API:
```
WA_PROVIDER=evolution
EVOLUTION_URL=https://sua-evolution.com
EVOLUTION_API_KEY=sua_chave
EVOLUTION_INSTANCE=runcoach
```

Para WhatsApp via Twilio:
```
WA_PROVIDER=twilio
TWILIO_SID=sua_sid
TWILIO_TOKEN=seu_token
TWILIO_FROM=whatsapp:+14155238886
```

## Custo
- Railway free tier: $5/mes em creditos gratis
- Para uso pessoal, geralmente cobre tranquilo
- Plano Hobby: $5/mes com mais recursos

## Testar Localmente
```bash
npm install
npm start
# Acesse http://localhost:3000
```
