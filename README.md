# Margin

Controle de gastos mensais com recorrentes, gastos pontuais, cartão variável, planejamento de objetivos (viagem, carro, reserva) e acesso **só por convite**.

Stack: Vue 3 + Vite + TypeScript, Tailwind v4, componentes no estilo shadcn (reka-ui), Pinia, Supabase (Postgres + Auth + Edge Function).

## Rodar localmente

Pré-requisitos: Node 22+ e Docker (o Supabase local roda em containers).

```bash
npm install
cp .env.example .env

npx supabase start          # sobe Postgres, Auth e Studio em containers
```

O `supabase start` imprime a **API URL** e a **anon key**: coloque em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

```bash
npx supabase db reset                 # aplica supabase/migrations
npx supabase functions serve          # em outro terminal: edge function accept-invite
npm run dev                           # http://localhost:5173
```

### Primeiro usuário = administrador

O cadastro público é desligado (`enable_signup = false`). Crie o primeiro usuário no Studio (http://127.0.0.1:54323, Authentication, Add user, marque "Auto Confirm"). Um trigger torna o primeiro usuário `admin`. Depois, tudo é pelo app: **Admin, Gerar convite**, ou aprovar um pedido de acesso feito na tela de login.

### Fluxo de convite

1. Admin gera o convite. O token aparece **uma vez** no link `/convite/<token>`; o banco guarda só o hash SHA-256.
2. A pessoa abre o link e cria a conta (a edge function valida e consome o convite de forma atômica).
3. Quem não tem link usa "Pedir acesso" na tela de login. O admin aprova e recebe um link para enviar.

## Docker (para aprender)

```bash
docker compose up --build          # http://localhost:8080
```

O Dockerfile tem dois estágios: Node compila o front e nginx serve os arquivos estáticos (com fallback de SPA). As variáveis `VITE_*` são embutidas **no build**, então mudar o `.env` exige `--build` de novo. De dentro do container, `localhost` é o próprio container: se usar o Supabase local, a URL no `.env` deve ser alcançável pelo **navegador** (`http://127.0.0.1:54321` funciona, porque quem chama é o navegador).

## Publicar de graça

1. Crie um projeto em supabase.com. Em **Authentication, Sign In / Providers**, desligue "Allow new users to sign up".
2. `npx supabase link --project-ref <ref>`, depois `npx supabase db push` e `npx supabase functions deploy accept-invite --no-verify-jwt`.
3. Front na Vercel (Vite é detectado sozinho): defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Adicione um rewrite de SPA (`vercel.json`: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`).
4. Crie sua conta de admin no painel do Supabase (Add user), antes de convidar alguém.

Limites a conhecer:
- O plano grátis do Supabase **pausa o projeto após ~1 semana sem uso** (reativa em um clique).
- A Vercel Hobby é para uso **não comercial**. Para cobrar por isso, precisa do plano pago ou outra hospedagem (a imagem Docker serve para isso).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checa tipos e gera `dist/` |
| `npm test` | testes do planejador (juros, financiamento, impacto no orçamento) |
| `npm run test:sql` | testa schema, RLS e funções em Postgres embarcado (PGlite) |

## Estrutura

```
supabase/migrations   schema, RLS, funções (ensure_month, request_access, check_invite...)
supabase/functions    accept-invite (service role; cria o usuário a partir do convite)
src/lib               formatação, categorias, planejador (funções puras), tokens
src/stores            Pinia: auth, month, recurring, goals, admin
src/views             Login, Convite, Mês, Recorrentes, Planejamento, Admin
src/components        ui/ (estilo shadcn), charts/ (SVG finos), diálogos
```
