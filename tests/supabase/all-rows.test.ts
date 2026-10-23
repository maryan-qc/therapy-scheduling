import { describe, expect, it } from "vitest";
import { allRows } from "@/lib/supabase/all-rows";

/** Імітація запиту з .range(from, to) над готовим набором рядків; записує, які сторінки просили. */
function fakeQuery(total: number) {
  const rows = Array.from({ length: total }, (_, index) => index);
  const ranges: [number, number][] = [];
  const page = (from: number, to: number) => {
    ranges.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { rows, ranges, page };
}

// Список утримань (/holds) потребує повного набору рядків, а Data API віддає щонайбільше 1000 на запит.
describe("усі рядки запиту сторінками", () => {
  it("AC-HOLD-38: список утримань читає всі сторінки — понад розмір сторінки нічого не губиться", async () => {
    const query = fakeQuery(5);

    expect(await allRows(query.page, 2)).toEqual(query.rows);
    expect(query.ranges).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("AC-HOLD-38: рівно кратна розміру сторінки кількість — ще одна порожня сторінка, і край", async () => {
    const query = fakeQuery(4);

    expect(await allRows(query.page, 2)).toEqual(query.rows);
    expect(query.ranges).toHaveLength(3);
  });

  it("помилка запиту — виняток, а не неповний список", async () => {
    const failing = () => Promise.resolve({ data: null, error: new Error("boom") });

    await expect(allRows(failing, 2)).rejects.toThrow("boom");
  });
});
