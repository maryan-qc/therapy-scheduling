// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування (формат — materials/uat/examples/negative-controls.spec.ts).
// Не AC-тести: назви починаються з NC-, а не з AC ID, тож ac:coverage їх не рахує. У звичайному прогоні їх немає
// (проєкт chromium має grepInvert @negative-control); запуск — npm run uat:nc. NC-1 і NC-2 лише читають; NC-3 створює синтетичну картку.
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент (R1);
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ
//          текстом і не погоджується → NEEDS-HUMAN (R3);
//   NC-3 (WS9, зріз 3) — як NC-1 для AC-INS-01: тест чекає «Insurance: Verified» на свіжій картці → FAIL (R1).
//          Пише: створює синтетичну картку uat-<прогін>-…@example.test (@writes).
import { expect, test, type Page } from "@playwright/test";
import { createCard, fresh } from "./support/cards";
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

test.describe("зріз 3", () => {
  test.use({ storageState: "playwright/.auth/scheduler.json" });

  test(
    "NC-3 (AC-INS-01, навмисно хибне очікування в тесті: «Verified» замість «Not set»)",
    {
      tag: ["@negative-control", "@writes"],
      annotation: [
        { type: "ac", description: "AC-INS-01" },
        { type: "case", description: "NC-3" },
      ],
    },
    async ({ page }) => {
      let href = "";
      await given("картку client6 створено, і статус перевірки страхування ще ніхто не позначав", async () => {
        href = await createCard(page, { type: "adult", ...fresh("Client Six", "nc3") });
      });
      await when("scheduler1 відкриває картку client6", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        { clause: "в картці показано «Insurance: Not set».", visible: ["рядок «Insurance: Not set» у картці"] },
        async () => {
          await expect(page.getByTestId("insurance")).toHaveText("Insurance: Verified", { timeout: 5_000 });
        },
      );
    },
  );
});
