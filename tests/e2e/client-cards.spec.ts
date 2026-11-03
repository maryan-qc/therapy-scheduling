// UAT трьох AC зрізу 2 (WS8): AC-CARD-05 (чужі дані за прямим посиланням), AC-CARD-11 (користувач без ролі),
// AC-CARD-12 (помилки форми картки). Текст AC — requirements/19-planuvalnyk-zapovniuie-kartku-klienta.md.
// Лише читання: AC-CARD-12 картки не створює, решта лише відкриває сторінки. Дані «Дано» на проді — синтетичні картки
// «Client Six» (client6@example.test) і «Client Nine» (client9@example.test) та сеанс «Confirmed» Client Nine у
// Therapist Two (docs/qa/proof-pack.md, розділ C). Адреси карток беремо зі списку планувальника, а не з коду.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

/** Усі адреси @example.test, які видно на сторінці. */
async function visibleEmails(page: Page): Promise<string[]> {
  const text = await page.locator("body").innerText();
  return [...new Set(text.match(/[\w.+-]+@example\.test/gi) ?? [])];
}

/** Окрема сесія іншої ролі (стан з tests/e2e/auth.setup.ts) — для «Дано» і «нічого не змінилося». */
async function asRole<T>(browser: Browser, role: string, body: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: `playwright/.auth/${role}.json`,
  });
  try {
    return await body(await context.newPage());
  } finally {
    await context.close();
  }
}

/** Адреса картки за назвою — зі списку /clients того, хто його відкрив. */
async function cardHref(page: Page, name: string): Promise<string> {
  await page.goto("/clients");
  const href = await page.getByRole("link", { name, exact: true }).getAttribute("href");
  expect(href, `картки «${name}» немає у списку`).toMatch(/^\/clients\/[0-9a-f-]{36}$/);
  return href!;
}

/** Дані однієї картки так, як їх бачить планувальник. */
async function cardData(page: Page, href: string): Promise<string> {
  await page.goto(href);
  return page.getByTestId("client-card").innerText();
}

/** Усі картки практики так, як їх бачить планувальник (таблиця /clients). */
async function allCards(page: Page): Promise<string> {
  await page.goto("/clients");
  return page.getByRole("table").innerText();
}

/** Сьогодні в поясі практики America/Los_Angeles (РРРР-ММ-ДД) і наступний день. */
function practiceToday(): { today: string; tomorrow: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { today, tomorrow: next.toISOString().slice(0, 10) };
}

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("терапевт", () => {
  test.use({ storageState: "playwright/.auth/therapist.json" });

  test(
    "AC-CARD-05: therapist1 відкриває картку client9 за прямим посиланням — «You don't have access to this client.», даних client9 немає",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-CARD-05" } },
    async ({ page, browser }) => {
      let href = "";
      let cardBefore = "";

      await given("client9 — свій клієнт лише для therapist2", async () => {
        // Картка client9 є (її бачить scheduler1), у therapist2 вона серед «My clients», у therapist1 — ні.
        ({ href, cardBefore } = await asRole(browser, "scheduler", async (p) => {
          const link = await cardHref(p, "Client Nine");
          return { href: link, cardBefore: await cardData(p, link) };
        }));
        const ofTherapist2 = await asRole(browser, "therapist2", async (p) => {
          await p.goto("/clients");
          return p.getByRole("main").innerText();
        });
        expect(ofTherapist2).toContain("Client Nine");
        await page.goto("/clients");
        await expect(page.getByRole("heading", { level: 1, name: "My clients" })).toBeVisible();
        await expect(page.getByRole("main").getByText("Client Nine")).toHaveCount(0);
      });

      await when("therapist1 відкриває картку client9 за прямим посиланням", async () => {
        await page.goto(href);
      });

      await thenStep(
        page,
        {
          clause:
            "therapist1 бачить повідомлення «You don't have access to this client.», жодних даних client9 не показано, і картка client9 не змінилася.",
          visible: ["повідомлення «You don't have access to this client.»"],
          hidden: [
            "жодних даних client9: на сторінці немає ні імені «Client Nine», ні client9@example.test, ні дати народження, блоку картки немає; з адрес видно лише власну therapist1@example.test",
            "картка client9 не змінилася: дані картки, які бачить scheduler1, до й після однакові",
          ],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("alert")).toHaveText("You don't have access to this client.");
          await expect(page.getByTestId("client-card")).toHaveCount(0);
          const text = await page.locator("body").innerText();
          expect(text).not.toContain("Client Nine");
          expect(text).not.toContain("1985-07-01");
          expect(await visibleEmails(page)).toEqual(["therapist1@example.test"]);
          expect(await asRole(browser, "scheduler", (p) => cardData(p, href))).toBe(cardBefore);
        },
      );
    },
  );
});

test.describe("користувач без ролі", () => {
  test.use({ storageState: "playwright/.auth/norole.json" });

  const CLAUSE =
    "він бачить лише повідомлення «Your account has no access yet. Contact an administrator.» і дію «Sign out», жодних даних клієнтів не показано, і жодна картка не змінилася.";
  const NO_ACCESS = "Your account has no access yet. Contact an administrator.";

  /** «Лише повідомлення й дія Sign out»: жодних посилань, таблиць чи адрес клієнтів. */
  async function expectOnlyNoAccess(page: Page) {
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByTestId("no-role")).toHaveText(NO_ACCESS);
    await expect(page.getByRole("button")).toHaveText(["Sign out"]);
    await expect(page.getByRole("link")).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(await visibleEmails(page)).toEqual([]);
  }

  test(
    "AC-CARD-11: newuser1 без ролі відкриває застосунок і картку client6 за посиланням — лише «Your account has no access yet. Contact an administrator.» і «Sign out»",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-CARD-11" } },
    async ({ page, browser }) => {
      let href = "";
      let cardsBefore = "";

      await given("користувач newuser1@example.test увійшов, але не має ролі", async () => {
        // Адреса картки client6 і всі картки до сценарію — так, як їх бачить scheduler1.
        ({ href, cardsBefore } = await asRole(browser, "scheduler", async (p) => ({
          href: await cardHref(p, "Client Six"),
          cardsBefore: await allCards(p),
        })));
      });

      await when("він відкриває застосунок", async () => {
        await page.goto("/");
      });
      await thenStep(
        page,
        {
          clause: CLAUSE,
          visible: ["повідомлення «Your account has no access yet. Contact an administrator.»", "дія «Sign out»"],
          hidden: ["лише це: жодного посилання, таблиці чи адреси @example.test на сторінці, одна кнопка — «Sign out»"],
        },
        async () => expectOnlyNoAccess(page),
      );

      await when("він відкриває картку client6 за прямим посиланням", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        {
          clause: CLAUSE,
          visible: ["повідомлення «Your account has no access yet. Contact an administrator.»", "дія «Sign out»"],
          hidden: [
            "даних client6 немає: застосунок перенаправив на головну, жодного посилання, таблиці чи адреси @example.test",
            "жодна картка не змінилася: усі картки, які бачить scheduler1, до й після однакові",
          ],
        },
        async () => {
          await expectOnlyNoAccess(page);
          expect(await asRole(browser, "scheduler", allCards)).toBe(cardsBefore);
        },
      );
    },
  );
});

test.describe("планувальник", () => {
  test.use({ storageState: "playwright/.auth/scheduler.json" });

  test(
    "AC-CARD-12: scheduler1 створює картку «Child» без імені, з датою завтра й без мови — три повідомлення біля полів, картку не створено",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-CARD-12" } },
    async ({ page }) => {
      // AC: «сьогодні 2026-11-03», дата народження 2026-11-04. Дату рахуємо від сьогодні в поясі практики, тож
      // 03.11 це дослівно дати AC, а в повторному прогоні (виправлення до 07.11) — той самий «завтра».
      const { today, tomorrow } = practiceToday();
      let cardsBefore = "";

      await given(`сьогодні ${today}`, async () => {
        cardsBefore = await allCards(page);
      });

      await when(
        `scheduler1 створює картку з типом «Child», порожнім ім'ям, датою народження ${tomorrow}, без мови сеансів, з ім'ям опікуна «Guardian Eight» і email опікуна guardian8@example.test`,
        async () => {
          await page.goto("/clients/new");
          await page.getByLabel("Client type").selectOption("child");
          await page.getByLabel("Date of birth").fill(tomorrow);
          await page.getByLabel("Guardian name").fill("Guardian Eight");
          await page.getByLabel("Guardian email").fill("guardian8@example.test");
          await page.getByRole("button", { name: "Create client card" }).click();
        },
      );

      await thenStep(
        page,
        {
          clause:
            "картку не створено, scheduler1 одразу бачить три повідомлення біля відповідних полів — «Enter the client's name.», «Enter a date of birth that is not in the future.» і «Select a session language.», а всі введені дані лишаються у формі.",
          visible: [
            "повідомлення «Enter the client's name.» під полем «Name»",
            "повідомлення «Enter a date of birth that is not in the future.» під полем «Date of birth»",
            "повідомлення «Select a session language.» під полем «Session language»",
            "тип клієнта «Child»",
            "ім'я опікуна «Guardian Eight»",
            "email опікуна guardian8@example.test",
          ],
          hidden: [
            `картку не створено: адреса лишилась /clients/new, а всі картки, які бачить scheduler1, до й після однакові`,
            `дата народження в полі — ${tomorrow} (формат дати на кадрі залежить від мови браузера), ім'я порожнє, мову не вибрано («Select…»)`,
            "повідомлень рівно три, і кожне пов'язане зі своїм полем (aria-describedby, aria-invalid)",
          ],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === "/clients/new");
          await expect(page.getByTestId("field-error")).toHaveText([
            "Enter the client's name.",
            "Enter a date of birth that is not in the future.",
            "Select a session language.",
          ]);
          await expect(page.locator("#card-name-error")).toHaveText("Enter the client's name.");
          await expect(page.locator("#card-dateOfBirth-error")).toHaveText("Enter a date of birth that is not in the future.");
          await expect(page.locator("#card-language-error")).toHaveText("Select a session language.");
          await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-describedby", "card-name-error");
          await expect(page.getByLabel("Date of birth")).toHaveAttribute("aria-invalid", "true");
          await expect(page.getByLabel("Session language")).toHaveAttribute("aria-invalid", "true");
          // Усе введене лишилось у формі.
          await expect(page.getByLabel("Client type")).toHaveValue("child");
          await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
          await expect(page.getByLabel("Date of birth")).toHaveValue(tomorrow);
          await expect(page.getByLabel("Session language")).toHaveValue("");
          await expect(page.getByLabel("Guardian name")).toHaveValue("Guardian Eight");
          await expect(page.getByLabel("Guardian email")).toHaveValue("guardian8@example.test");
          // Картку не створено: окрема вкладка тієї самої сесії, щоб кадр лишився на формі.
          const list = await page.context().newPage();
          try {
            expect(await allCards(list)).toBe(cardsBefore);
          } finally {
            await list.close();
          }
        },
      );
    },
  );
});
