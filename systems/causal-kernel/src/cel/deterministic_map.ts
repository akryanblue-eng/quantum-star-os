import { compareUtf8 } from "../codec/canonical";

// Map replacement for kernel execution paths. Native Map iteration order
// is insertion order — deterministic per run but a standing invitation
// for order-dependent bugs. This structure has exactly one iteration
// order: UTF-8 bytewise sorted keys, always.

export class DeterministicMap<V> {
  private store: Record<string, V> = Object.create(null);

  set(key: string, value: V): void {
    this.store[key] = value;
  }

  get(key: string): V | undefined {
    return this.store[key];
  }

  has(key: string): boolean {
    return key in this.store;
  }

  delete(key: string): void {
    delete this.store[key];
  }

  get size(): number {
    return Object.keys(this.store).length;
  }

  entries(): [string, V][] {
    return Object.entries(this.store).sort(([a], [b]) => compareUtf8(a, b));
  }

  clone(): DeterministicMap<V> {
    const copy = new DeterministicMap<V>();
    for (const key of Object.keys(this.store)) {
      copy.store[key] = this.store[key];
    }
    return copy;
  }
}
