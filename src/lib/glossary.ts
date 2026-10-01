// Explicações curtas, em linguagem do dia a dia, para termos financeiros usados no app.
export const GLOSSARY = {
  patrimonio: {
    term: "Dinheiro guardado (patrimônio)",
    text: "Tudo o que você tem (saldo nas contas e investimentos) menos o que você deve agora (fatura do cartão).",
  },
  sobra: {
    term: "Sobra do mês",
    text: "Quanto entrou menos quanto saiu. Se for positivo, você pode guardar ou investir esse valor.",
  },
  transferencia: {
    term: "Por que transferências não contam?",
    text: "Mandar dinheiro de uma conta sua para outra, pagar a fatura ou aplicar em investimento não é gasto nem ganho; só muda o dinheiro de lugar.",
  },
  recorrente: {
    term: "Cobrança recorrente",
    text: "Algo que aparece todo mês com valor parecido, como streaming, academia ou plano de celular. É o primeiro lugar para cortar gastos.",
  },
  previsao: {
    term: "Previsão do mês",
    text: "Uma estimativa de quanto você vai gastar até o fim do mês se continuar no ritmo atual. No começo do mês usamos a média dos meses anteriores.",
  },
  orcamento: {
    term: "Limite de gastos (orçamento)",
    text: "Um valor máximo que você decide gastar por mês em uma categoria, como R$ 600 em alimentação.",
  },
  meta: {
    term: "Meta",
    text: "Um valor que você quer juntar até uma data, como R$ 5.000 até dezembro.",
  },
  reserva: {
    term: "Reserva de emergência",
    text: "Dinheiro guardado para imprevistos (saúde, desemprego, conserto). O comum é juntar de 3 a 6 meses dos seus gastos, num investimento que dá para sacar a qualquer hora.",
  },
  cdi: {
    term: "CDI",
    text: "Taxa de referência usada pela maioria dos investimentos de renda fixa. \"100% do CDI\" significa render igual a essa taxa.",
  },
  ipca: {
    term: "Inflação (IPCA)",
    text: "Quanto os preços subiram. Se seu dinheiro rende menos que a inflação, ele está perdendo poder de compra.",
  },
  selic: {
    term: "Selic",
    text: "Taxa básica de juros do país, definida pelo Banco Central. Quando sobe, a renda fixa costuma render mais.",
  },
  rentabilidade: {
    term: "Rentabilidade",
    text: "Quanto um investimento ganhou (ou perdeu) em relação ao valor aplicado, em porcentagem.",
  },
  alocacao: {
    term: "Alocação",
    text: "Como seu dinheiro investido está dividido entre tipos de investimento (renda fixa, ações, fundos...). Definir uma alocação-alvo ajuda a manter o risco que você escolheu.",
  },
  aporte: {
    term: "Aporte",
    text: "Dinheiro novo que você coloca num investimento, por exemplo todo mês.",
  },
  juros_compostos: {
    term: "Juros compostos",
    text: "Juros que rendem sobre juros. Quanto mais tempo o dinheiro fica aplicado, mais rápido ele cresce.",
  },
  open_finance: {
    term: "Open Finance",
    text: "Sistema oficial do Banco Central em que você autoriza, no app do seu banco, que outro serviço leia seus dados. Ninguém vê sua senha, e você pode cancelar quando quiser.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

// Dicas curtas por página, mostradas uma de cada vez e que podem ser dispensadas.
export const TIPS: Record<string, Array<{ id: string; title: string; text: string; learnMore?: GlossaryKey }>> = {
  home: [
    { id: "home-reserva", title: "Comece pela reserva de emergência", text: "Antes de investir em algo arriscado, junte alguns meses dos seus gastos num investimento que dá para sacar a qualquer hora.", learnMore: "reserva" },
    { id: "home-recorrentes", title: "Olhe as cobranças que se repetem", text: "Assinaturas pequenas somadas viram um valor grande no ano. Cancele as que você não usa.", learnMore: "recorrente" },
  ],
  budgets: [
    { id: "budgets-50-30-20", title: "Regra 50-30-20", text: "Uma referência simples: 50% da renda para o essencial (moradia, comida, contas), 30% para o resto e 20% para guardar ou investir.", learnMore: "orcamento" },
  ],
  investments: [
    { id: "inv-cdi", title: "Compare com o CDI e com a inflação", text: "Um investimento que rende menos que a inflação faz seu dinheiro perder valor. O CDI é a régua mais comum da renda fixa.", learnMore: "cdi" },
  ],
  simulation: [
    { id: "sim-tempo", title: "O tempo trabalha a seu favor", text: "Aportes pequenos todo mês, por muitos anos, costumam render mais que um valor grande aplicado tarde.", learnMore: "juros_compostos" },
  ],
  expenses: [
    { id: "exp-categorias", title: "Categorias se ajustam sozinhas", text: "Quando você corrige a categoria de uma transação do banco, o Nexos aprende e aplica nas próximas parecidas." },
  ],
};
