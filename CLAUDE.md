# Margin — contexto para continuar o projeto

App de gastos mensais, micro SaaS **só por convite**. Dono/admin: o próprio usuário. Idioma da interface: **PT-BR**.

## Decisões do dono (não reverter sem perguntar)
- Vue 3 (Composition API, `<script setup>`), Vite, TypeScript estrito, Pinia, vue-router.
- Supabase (Postgres + RLS + Auth + Edge Function). Front na Vercel ou em Docker (nginx).
- Docker é também para o dono **aprender**: manter Dockerfile/compose simples e comentados.
- UI compacta, limpa, premium, **dark neutro**: fundo `#232222`, superfícies `#2b2a2a/#313030/#3b3a3a`, texto branco. Azul só como cor primária (ações, seleção, medidor) com escala `brand-50…950`. Tokens em `src/style.css` (nomes do shadcn). Fonte Geist.
- Gráficos **finos** (barras ≤14px, linhas 1.5px, anel 12px), com tooltip e alternativa acessível. Paleta **monocromática**: o azul da marca no máximo (`--chart-1` = `--primary`) e, a cada passo, mais diluído na superfície `--card` (100, 83, 69, 57, 47, 39, 32, 27%, em `style.css`). Cada categoria mantém sempre o mesmo tom. (Pedido do dono: antes eram cores diferentes; depois um degradê que ficava claro demais e parecido.)
- Componentes no estilo shadcn-vue sobre reka-ui + Tailwind v4 (`src/components/ui`).

## Modelo de dados
- Meses são strings `'YYYY-MM-01'`.
- `recurring_expenses` (kind `fixed|variable`, `start_month`, `end_month`) geram linhas em `month_entries` via `ensure_month`. Variáveis (cartão) entram com `is_estimate=true` = média dos últimos 3 meses confirmados; editar o valor tira a marca de estimativa. `skipped` pula um mês. Gasto pontual = `month_entries` com `recurring_id` nulo.
- Salário do mês copia o do mês anterior.
- Rendas extras do mês: `month_incomes` (Pix, bônus...). `month.income` = salário + extras e é a base da sobra/peso.
- Objetivo com itens: `goal_items` (`payment` = `cash` | `installments`, entrada, parcelas, o que já foi pago). `goals.my_share` = parte do usuário (0.5 = dividido com a noiva). `src/lib/goal-items.ts` calcula custo, juros e parcelas do mês; `effectiveGoal` entrega ao planejador só a parte do usuário (à vista + entradas) e as parcelas do mês entram no peso das metas. Testes em `goal-items.test.ts`.
- Cartão e reembolso: `on_card` marca gasto pago no cartão (continua contando; o total no cartão é o valor cheio da fatura). `reimbursement` (por gasto/recorrente/item de objetivo) é o que devolvem ao usuário: o custo do gasto é `amount − reimbursement` (`netOf` em `stores/month.ts`) e o mês mostra reembolsos a receber/recebidos (`reimbursed`). Em objetivos o reembolso é do usuário e abate **depois** de dividir (`my_share`); em itens parcelados só reduz o custo total, não a entrada.
- Fatura do cartão: `card_bill` marca o lançamento que é a fatura (valor cheio); gastos `on_card` ficam **dentro** dela e não somam de novo (se não há fatura no mês, `on_card` é só marcador). Detalhado > fatura: vale a soma. O que sobra sem detalhe entra na categoria da fatura. Regra em `src/lib/card-bill.ts` (`monthBuckets`, testada) e usada pelo mês e pelo gráfico mês a mês. Itens parcelados de objetivo com `in_card_bill` aparecem dentro da fatura e não pesam de novo nas metas quando o mês tem fatura.
- Investimentos: `month_settings.invest` (valor planejado, copia o do mês anterior como o salário) e `invest_done` ("já aportei"). Não é gasto: aparece no cartão Investimentos como "livre depois de investir" = sobra depois das metas − investimento.
- Objetivo com itens e valor total maior que a soma dos itens: a diferença é "a detalhar" (estimativa à vista) e entra como valor a guardar (`undetailedOf` em `goal-items.ts`).
- `goals` + `goal_contributions`; matemática em `src/lib/planner.ts` (anuidade com rendimento, financiamento pela tabela Price, impacto = sobra − soma dos aportes). Testes em `planner.test.ts`.

## Acesso
- `enable_signup=false`. Convite: token de 32 bytes no link `/convite/<token>`; só o **hash SHA-256** vai ao banco (`invites.token_hash`). Edge Function `accept-invite` consome o convite de forma atômica e cria o usuário (service role).
- "Pedir acesso" chama a RPC `request_access` (anon, com limites, sem revelar se o e-mail existe). Admin aprova e gera link.
- Primeiro usuário vira `admin` por trigger; usuários não conseguem alterar `role` (grant por coluna).

## Comandos
`npm run dev` · `npm run build` (vue-tsc + vite) · `npm test` · `npm run test:sql` · `npx supabase start|db reset|functions serve` · `docker compose up --build`.
Antes de dar algo por pronto: build + testes + abrir a tela no navegador.

## Estado
Pronto: schema/RLS/funções (56 checagens SQL), planejador, itens e fatura (39 testes), todas as telas, Docker.
Já roda contra o Supabase **na nuvem** (projeto Margin, migrations aplicadas com `npx supabase db push`, função `accept-invite` publicada). **Ainda não validado**: Docker (o dono não tem Docker instalado) e o fluxo de convite de ponta a ponta.

## Ideias a seguir
Tema claro (hoje só dark), exportar CSV, categorias personalizadas, gráficos por categoria ao longo dos meses, PWA, e-mail automático nos convites.

## Armadilhas
- O Windows do dono tem "reduzir animações" ligado: `style.css` zera animações no `prefers-reduced-motion`, exceto `.skeleton` (varredura suave de propósito).
- Grids de página usam `grid-cols-[minmax(0,1fr)]` para a coluna nunca passar do container (senão as linhas ficam com larguras diferentes).
