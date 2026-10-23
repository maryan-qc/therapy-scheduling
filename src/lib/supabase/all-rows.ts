// Data API Supabase віддає щонайбільше 1000 рядків на запит (max-rows), тож список, якому потрібен повний набір
// рядків, читаємо сторінками до кінця. Запит сторінки має стабільний порядок (order + range).
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Усі рядки запиту: `page(from, to)` — той самий запит з `.range(from, to)`. Помилка — виняток, а не неповний список. */
export async function allRows<T>(page: (from: number, to: number) => Page<T>, size = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < size) return rows;
  }
}
