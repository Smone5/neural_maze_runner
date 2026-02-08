export interface Rng {
  next(): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: T[]): T;
}

export function makeRng(seed: number): Rng {
  let t = seed >>> 0;

  const next = (): number => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, maxInclusive: number): number {
      const value = min + Math.floor(next() * (maxInclusive - min + 1));
      return Math.min(maxInclusive, Math.max(min, value));
    },
    pick<T>(items: T[]): T {
      return items[Math.floor(next() * items.length)];
    },
  };
}
