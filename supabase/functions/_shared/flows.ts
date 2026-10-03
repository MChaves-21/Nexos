// O que entra no resumo de entradas e saídas do mês. Módulo puro, usado pelo app e pelo servidor.
//
// - Transferência (ex.: Pix entre as próprias contas): não é entrada nem saída.
// - Investimento conta como no extrato do banco:
//   - aporte (dinheiro saindo da conta) é saída;
//   - dividendo ou resgate (voltando para a conta) é entrada.
//   O dinheiro continua seu: por isso não muda o patrimônio (veja changesNetWorth).

export function countsInSummary(category: string | null | undefined): boolean {
  return category !== "Transferência";
}

/**
 * Muda o patrimônio? Aporte só tira da conta e põe no investimento (o saldo investido sobe);
 * transferência só troca de conta. Nenhum dos dois deixa você mais rico ou mais pobre.
 */
export function changesNetWorth(category: string | null | undefined): boolean {
  return category !== "Transferência" && category !== "Investimento";
}

/**
 * É gasto de consumo? Entra em "quanto você gastou", categorias, alertas, orçamento e previsão.
 * Aporte não é gasto: o dinheiro continua seu, só foi para o investimento.
 */
export function isSpending(category: string | null | undefined): boolean {
  return changesNetWorth(category);
}
