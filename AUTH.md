# Autenticacao

Sistema de login email + senha embutido no app.

## Como funciona

- **Hash de senha**: `crypto.scryptSync` (built-in do Node — sem bcrypt nem nada nativo).
  Formato armazenado: `scrypt$N,r,p$<salt>$<hash>`.
- **Sessao**: token aleatorio de 32 bytes em cookie `mota_sess` (HttpOnly, Secure em
  producao, SameSite=Lax). Linha correspondente fica na tabela `sessions`.
  Expira em 30 dias (rolling — cada login renova).
- **Middleware**: `lib/auth.js → requireAuth(req, res)` carrega o usuario via
  cookie e devolve 401 se nao houver sessao valida. Todos os endpoints de dados
  (`/api/data`, `/api/log/*`, `/api/meal/*`, `/api/race/*`, `/api/sync`) usam.
- **Owner role**: ao se cadastrar com o email `OWNER_EMAIL` (variavel de ambiente),
  se ainda nao houver nenhum usuario com role `owner`, o novo usuario vira owner
  E recebe automaticamente todos os dados orfaos (`owner_id IS NULL`).

## Variaveis de ambiente novas

| Nome | Descricao | Obrigatorio |
|---|---|---|
| `OWNER_EMAIL` | Email que recebe role owner + auto-claim dos dados historicos. Ex.: `matheusmota96@gmail.com` | Sim, para o claim funcionar |
| `MIGRATE_SECRET` | Ja existe — agora tambem protege `/api/admin/claim-orphans` | (ja configurado) |

## Endpoints

| Metodo | Caminho | Auth | Descricao |
|---|---|---|---|
| POST | `/api/auth/signup`     | publico | cria usuario, abre sessao, faz auto-claim se for owner |
| POST | `/api/auth/login`      | publico | valida senha, abre sessao |
| POST | `/api/auth/logout`     | sessao  | destroi sessao + limpa cookie |
| GET  | `/api/auth/me`         | sessao  | retorna usuario atual |
| POST | `/api/admin/claim-orphans?key=$MIGRATE_SECRET` | secret | fallback: vincula orfaos a `OWNER_EMAIL` (ou `?email=...`) |

## Fluxo recomendado pos-deploy

1. Definir `OWNER_EMAIL=matheusmota96@gmail.com` nas env vars da Vercel.
2. Abrir o app, clicar **Cadastrar**, usar `matheusmota96@gmail.com` + senha forte.
3. O auto-claim acontece sozinho — todos os treinos, refeicoes, provas e o atleta
   antigos ficam vinculados a essa conta. Voce vai ver no console do browser:
   `Auto-claim aplicado: N treinos, N refeicoes, N provas, 1 atleta`.
4. (fallback) Se a ordem dos eventos der errado, rodar manualmente:
   `POST https://runcoach-pro.vercel.app/api/admin/claim-orphans?key=$MIGRATE_SECRET`

## Schema

Adicionados (idempotente — tudo `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`):

```
users    (id SERIAL PK, email TEXT UNIQUE, password_hash TEXT, name, role, created_at)
sessions (token TEXT PK, user_id FK→users, created_at, expires_at)
```

Colunas `owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE` adicionadas em
`athlete`, `logs`, `meals`, `races` (com indice em cada). A constraint
`athlete_singleton` foi removida e o default de `id=1` tambem.

## SQL de migration manual (se precisar rodar fora do app)

Tudo isso ja roda automatico no primeiro request via `lib/db.js → ensureSchema`.
Mas para inspecao:

```sql
-- 1) Tabelas novas
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2) Colunas owner_id
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE logs    ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE meals   ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE races   ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 3) Vincular orfaos a Mota (depois que ele se cadastrar)
WITH owner AS (SELECT id FROM users WHERE email = 'matheusmota96@gmail.com')
UPDATE logs SET owner_id = (SELECT id FROM owner) WHERE owner_id IS NULL;
-- Repetir para meals, races, athlete.
```

## Segurança

- Senhas nunca trafegam por log (signup/login fazem `readBody` mas nada e logado).
- Tokens de sessao nao aparecem em URLs.
- Cookie HttpOnly bloqueia roubo via XSS.
- 401 leva o frontend a re-exibir o login automaticamente.
- O endpoint admin exige `MIGRATE_SECRET` por query string — nao expor em
  bookmarks publicos.
