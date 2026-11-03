// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування (формат — materials/uat/examples/negative-controls.spec.ts).
// Не AC-тести: назви починаються з NC-, а не з AC ID, тож ac:coverage їх не рахує. У звичайному прогоні їх немає
// (проєкт chromium має grepInvert @negative-control); запуск — npm run uat:nc. Лише читання: безпечно на проді.
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент (R1);
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ
//          текстом і не погоджується → NEEDS-HUMAN (R3).
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/therapist.json" });

const CLAUSE =
  "therapist1 бачить повідомлення «You don't have access to this client.», жодних даних client9 не показано, і картка client9 не змінилася.";

/** Пряме посилання на картку client9 — зі списку планувальника (як у client-cards.spec.ts). */
async function client9Href(page: Page): Promise<string> {
  const context = await page.context().browser()!.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: "playwright/.auth/scheduler.json",
  });
  try {
    const list = await context.newPage();
    await list.goto("/clients");
    return (await list.getByRole("link", { name: "Client Nine", exact: true }).getAttribute("href"))!;
  } finally {
    await context.close();
  }
}

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "NC-1 (AC-CARD-05, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-CARD-05" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    let href = "";
    await given("client9 — свій клієнт лише для therapist2", async () => {
      href = await client9Href(page);
    });
    await when("therapist1 відкриває картку client9 за прямим посиланням", async () => {
      await page.goto(href);
    });
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «You don't have access to this client.»"] }, async () => {
      await expect(page.getByRole("main").getByRole("alert")).toHaveText("You do not have access to this client.", {
        timeout: 5_000,
      });
    });
  },
);

test(
  "NC-2 (AC-CARD-05, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-CARD-05" },
      { type: "case", description: "NC-2" },
      {
        type: "ac-text",
        description:
          "AC-CARD-05: Дано client9 — свій клієнт лише для therapist2. Коли therapist1 відкриває картку client9 за прямим посиланням. Тоді therapist1 бачить повідомлення «This client card is private.», жодних даних client9 не показано, і картка client9 не змінилася.",
      },
    ],
  },
  async ({ page }) => {
    let href = "";
    await given("client9 — свій клієнт лише для therapist2", async () => {
      href = await client9Href(page);
    });
    await when("therapist1 відкриває картку client9 за прямим посиланням", async () => {
      await page.goto(href);
    });
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «You don't have access to this client.»"] }, async () => {
      await expect(page.getByRole("main").getByRole("alert")).toHaveText("You don't have access to this client.");
    });
  },
);
