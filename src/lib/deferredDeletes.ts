// Exclusões com "Desfazer": cada item espera o próprio prazo, independente dos outros.

export class DeferredDeletes<T extends { id: string }> {
  private pending = new Map<string, { item: T; timer: ReturnType<typeof setTimeout> }>();

  constructor(private readonly run: (item: T) => Promise<void>, private readonly delayMs = 5000) {}

  /** Agenda a exclusão de verdade para daqui a `delayMs`. */
  schedule(item: T): void {
    this.cancel(item.id);
    const timer = setTimeout(() => void this.flush(item.id), this.delayMs);
    this.pending.set(item.id, { item, timer });
  }

  /** Desfaz: devolve o item se a exclusão ainda não aconteceu. */
  cancel(id: string): T | null {
    const p = this.pending.get(id);
    if (!p) return null;
    clearTimeout(p.timer);
    this.pending.delete(id);
    return p.item;
  }

  /** Exclui agora (ex.: a pessoa está saindo da página). */
  async flush(id: string): Promise<void> {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    await this.run(p.item);
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.flush(id)));
  }

  get size(): number {
    return this.pending.size;
  }
}
