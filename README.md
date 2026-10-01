Desenvolvi o Nexos, uma plataforma de gestão financeira inteligente criada para centralizar o controle de património, investimentos e fluxo de caixa. O projeto foi construído utilizando o Lovable, uma plataforma de desenvolvimento baseada em IA que permitiu transformar conceitos complexos em uma interface robusta e funcional de forma ágil. Muito além de uma simples folha de cálculo, o Nexos conecta rendimentos a metas reais, oferecendo uma visão clara para organização e projeções de longo prazo. O objetivo é transformar dados em decisões, ajudando os utilizadores a dominarem as suas carteiras e acelerarem a sua independência financeira.
# 💰 Nexos - Gestão Financeira Inteligente

![Nexos Dashboard](./public/nexos1.png)
![Nexos Transações](./public/nexos2.png)

O **Nexos** é uma solução completa para controle de finanças pessoais, desenvolvida para ajudar usuários a organizarem suas receitas e despesas com uma interface intuitiva e um backend robusto e conectado.

## 🛠️ Funcionalidades Principais
- ✅ **Autenticação Segura:** Proteção de dados e acesso individualizado.
- ✅ **Fluxo de Caixa:** Registro detalhado de todas as entradas e saídas.
- ✅ **Dashboard Dinâmico:** Visualização clara do resumo mensal e saldo atual.
- ✅ **Categorização:** Organização inteligente de transações para melhor análise de gastos.

## 📦 Como rodar o projeto

```bash
# 1. Clone o repositório
git clone [https://github.com/MChaves-21/xnexos](https://github.com/MChaves-21/xnexos)

# 2. Suba o banco de dados via Docker
docker-compose up -d

# 3. Instale as dependências
npm install

# 4. Rode as migrações do Prisma para estruturar o banco
npx prisma migrate dev

# 5. Inicie o servidor de desenvolvimento
npm run dev

## 🏦 Open Finance e importação de extratos

O Nexos importa transações e investimentos de duas formas, que caem na mesma tela (**Open Finance**) e passam pela mesma deduplicação e categorização.

### 1. Arquivo CSV/OFX (gratuito, sem terceiros)
No app do Nubank, exporte a **fatura do cartão (CSV)** ou o **extrato da conta (CSV ou OFX)** e use **Importar arquivo**.
- O arquivo é lido no navegador; nada é enviado além das transações já normalizadas para o seu banco Supabase.
- Reimportar o mesmo arquivo não duplica: usa o `Identificador`/`FITID` quando existe, senão um hash de conta + data + valor + descrição.
- Parcelas ("Parcela 2/5"), estornos, UTF-8/Windows-1252 e vírgula ou ponto decimal são tratados.
- Não versione extratos reais (`*.ofx` e CSVs na raiz estão no `.gitignore`).

### 2. Conexão automática via Pluggy (Open Finance)
1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) e pegue `CLIENT_ID` e `CLIENT_SECRET`.
2. Cadastre como secrets das Edge Functions (nunca no `.env` do front):
   `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `PLUGGY_CRON_SECRET` (um valor aleatório longo).
3. Para uso pessoal gratuito, conecte seu banco no **Meu Pluggy** (meu.pluggy.ai) e cole o *Item ID* em **Conectar Banco → Meu Pluggy**. O botão **Abrir Pluggy Connect** abre o widget oficial (inclui os conectores de sandbox; desligue com `VITE_PLUGGY_INCLUDE_SANDBOX=false`). Confira os limites atuais do plano gratuito na documentação da Pluggy.
4. Sincronização automática diária (06:00): a migração `20260930193700_…sql` agenda o job com `pg_cron`. Guarde o mesmo valor de `PLUGGY_CRON_SECRET` no Vault uma vez:
   ```sql
   select vault.create_secret('<valor de PLUGGY_CRON_SECRET>', 'pluggy_cron_secret');
   ```

A sincronização busca o status do item (consentimento expirado vira **Reconectar**), as contas, as transações de cada conta (com paginação, ignorando as pendentes) e os investimentos.

### Categorização
Ordem: regras aprendidas com as suas correções → regras padrão por palavra-chave → IA (só para o que sobrar). Ao trocar a categoria de uma transação, o Nexos grava a regra e aplica às pendentes parecidas.

### Testes
```bash
npm test
```

## 🧭 Modo simples e modo completo
- **Simples (padrão para novas contas):** menu com Início, Transações, Metas e Conectar banco; resumo do mês em frases, alertas e maiores gastos.
- **Completo:** acrescenta Investimentos (com comparação ao CDI e à inflação), Simulador (preenchido com seus dados), Relatórios, Categorização, Regras e os gráficos do Início.
- A escolha fica no perfil (`profiles.ui_mode`) e vale em qualquer dispositivo. O primeiro acesso guiado aparece uma vez (`profiles.onboarding_completed`).
- Taxas Selic, CDI e IPCA vêm da Edge Function `market-rates` (API pública do Banco Central, com valores de reserva se estiver fora do ar).
