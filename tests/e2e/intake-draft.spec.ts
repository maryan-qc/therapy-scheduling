// UAT зрізу 4: чернетка картки клієнта з тексту звернення на проді — AC-INTAKE-03 і AC-INTAKE-06. Текст AC —
// requirements/36-chernetka-kartky-z-tekstu-zvernennia.md. Помічник — безкоштовна модель OpenRouter з денним лімітом
// запитів (design.md зміни impl-intake-draft-assistant), тож тут лише два AC і кожен тест робить рівно ОДИН запит до
// помічника; решту AC-INTAKE доводять unit-тести й офлайн-реплей golden cases (tests/clients/intake*.test.ts*,
// tests/golden.test.ts). Карток ці тести не створюють, тож і прибирати нічого (без тегу @writes).
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

// Тексти з AC PM — дослівно.
const CLIENT_TEN_REQUEST =
  "Hi, my name is Client Ten, I was born on May 14, 1990. I'd like individual sessions in English. My email is client10@example.test.";
const NOT_A_CLIENT_REQUEST = "Can you recommend a good book about anxiety?";
const DRAFT_READY = "Draft ready. Check the fields and create the card.";
const DRAFT_REFUSED =
  "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.";

// Відповідь безкоштовної моделі (з тайм-аутом і запасними моделями ланцюжка) може тривати до хвилини.
const ASSISTANT_TIMEOUT = 90_000;
test.describe.configure({ timeout: 180_000 });

/** Вставити текст звернення й попросити чернетку — один запит до помічника. */
async function requestDraft(page: Page, text: string) {
  await page.getByLabel("Client's request").fill(text);
  await page.getByRole("button", { name: "Draft card from request" }).click();
}

/** Повідомлення результату панелі чернетки (role="status") з цим текстом. */
const draftMessage = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("чернетка картки з тексту звернення — планувальник", () => {
  test.use({ storageState: "playwright/.auth/scheduler.json" });

  test(
    "AC-INTAKE-03: scheduler1 не створює картку з чернетки за текстом AC-INTAKE-01 — у списку клієнтів картки «Client Ten» немає",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-INTAKE-03" } },
    async ({ page }) => {
      await given("чернетку за текстом з AC-INTAKE-01 заповнено у формі нової картки", async () => {
        // Дано з AC-INTAKE-01: клієнта з email client10@example.test ще немає.
        await page.goto("/clients");
        await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Client Ten", exact: true })).toHaveCount(0);
        await expect(page.getByRole("main")).not.toContainText("client10@example.test");

        await page.goto("/clients/new");
        await requestDraft(page, CLIENT_TEN_REQUEST);
        await expect(draftMessage(page, DRAFT_READY)).toHaveText(DRAFT_READY, { timeout: ASSISTANT_TIMEOUT });
        await expect(page.getByLabel("Client type")).toHaveValue("adult");
        await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Client Ten");
        await expect(page.getByLabel("Date of birth")).toHaveValue("1990-05-14");
        await expect(page.getByLabel("Session language")).toHaveValue("English");
        await expect(page.getByLabel("Email", { exact: true })).toHaveValue("client10@example.test");
      });

      await when("scheduler1 не створює картку й відкриває список клієнтів", async () => {
        await page.goto("/clients");
      });

      await thenStep(
        page,
        {
          clause:
            "картки «Client Ten» у списку немає: картку створює лише сам планувальник, коли зберігає форму.",
          visible: ["список клієнтів «Clients» у scheduler1", "у списку немає картки «Client Ten»"],
          hidden: [
            "перед тим чернетку заповнено: «Draft ready. Check the fields and create the card.», Client type «Adult», Name «Client Ten», Date of birth 1990-05-14, Session language «English», Email client10@example.test (перевірки кроку «Дано»)",
            "картки «Client Ten» і адреси client10@example.test немає в усьому списку, а не лише на кадрі",
          ],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === "/clients");
          await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
          await expect(page.getByRole("link", { name: "Client Ten", exact: true })).toHaveCount(0);
          await expect(page.getByRole("main")).not.toContainText("Client Ten");
          await expect(page.getByRole("main")).not.toContainText("client10@example.test");
        },
      );
    },
  );

  test(
    "AC-INTAKE-06: scheduler1 з Name «Client Fifteen» у формі просить чернетку з тексту не про нового клієнта — форма без змін і «This text can't be used to draft a client card. …»",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-INTAKE-06" } },
    async ({ page }) => {
      await given("у формі нової картки вже введено Name «Client Fifteen»", async () => {
        await page.goto("/clients/new");
        await page.getByLabel("Name", { exact: true }).fill("Client Fifteen");
      });

      await when(`scheduler1 просить скласти чернетку з тексту звернення «${NOT_A_CLIENT_REQUEST}»`, async () => {
        await requestDraft(page, NOT_A_CLIENT_REQUEST);
      });

      await thenStep(
        page,
        {
          clause: `поля форми не змінено (Name лишається «Client Fifteen»), і scheduler1 бачить повідомлення «${DRAFT_REFUSED}»`,
          visible: [`повідомлення «${DRAFT_REFUSED}»`, "поле «Name» — «Client Fifteen»"],
          hidden: [
            "інші поля форми такі, як до запиту: Client type і Session language не вибрано («Select…»), Date of birth порожнє",
            "картку не створено: адреса лишилась /clients/new",
          ],
        },
        async () => {
          await expect(draftMessage(page, DRAFT_REFUSED)).toHaveText(DRAFT_REFUSED, { timeout: ASSISTANT_TIMEOUT });
          await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Client Fifteen");
          await expect(page.getByLabel("Client type")).toHaveValue("");
          await expect(page.getByLabel("Date of birth")).toHaveValue("");
          await expect(page.getByLabel("Session language")).toHaveValue("");
          await expect(page).toHaveURL((url) => url.pathname === "/clients/new");
        },
      );
    },
  );
});
