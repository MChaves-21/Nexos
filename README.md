Desenvolvi o Nexos, uma plataforma de gestão financeira inteligente criada para centralizar o controle de património, investimentos e fluxo de caixa. O projeto foi construído utilizando o Lovable, uma plataforma de desenvolvimento baseada em IA que permitiu transformar conceitos complexos em uma interface robusta e funcional de forma ágil. Muito além de uma simples folha de cálculo, o Nexos conecta rendimentos a metas reais, oferecendo uma visão clara para organização e projeções de longo prazo. O objetivo é transformar dados em decisões, ajudando os utilizadores a dominarem as suas carteiras e acelerarem a sua independência financeira.
# 💰 Nexos - Gestão Financeira Inteligente

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
