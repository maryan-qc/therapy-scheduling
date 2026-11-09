// UAT зрізу 3 (WS9): статус перевірки страхування (AC-INS-01…06). Текст AC —
// requirements/33-planuvalnyk-poznachaie-status-strakhuvannia.md. Документи згоди (AC-DOC, #34) PM переніс на пізніший
// зріз (рішення 2026-11-06), тож їхніх тестів тут немає.
// Дані «Дано» тести створюють самі (припущення PM): статус «Not set» не повертається, тож кожен тест бере свіжу
// синтетичну картку «… <прогін>» з адресою uat-<прогін>-…@example.test, а «свого
// клієнта» робить утриманням на вільному слоті через /slots. Картки, утримання й сеанси лишаються на проді як
// синтетичні дані прогону (docs/qa/uat/).
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

// «Дано» кожного AC будує дані на проді через сторінки (нова картка, статус, утримання слоту, сесії інших ролей), тож
// 60 с типового ліміту замало: до 3 хвилин на тест.
test.describe.configure({ timeout: 180_000 });

const RUN = process.env.UAT_RUN ?? "local";
let seq = 0;
/** Унікальна в межах прогону назва й адреса картки: «Client Six 2611061830-3», uat-2611061830-3-c6@example.test. */
function fresh(label: string, tag: string) {
  seq += 1;
  return { name: `${label} ${RUN}-${seq}`, email: `uat-${RUN}-${seq}-${tag}@example.test` };
}

/** Окрема сесія іншої ролі (стан з tests/e2e/auth.setup.ts). */
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

type NewCard =
  | { type: "adult"; name: string; email: string }
  | { type: "child"; name: string; guardianName: string; guardianEmail: string };

/** Картка з анкети через /clients/new (від імені того, хто відкрив сторінку); повертає адресу картки. */
async function createCard(page: Page, card: NewCard): Promise<string> {
  await page.goto("/clients/new");
  await page.getByLabel("Client type").selectOption(card.type);
  await page.getByLabel("Name", { exact: true }).fill(card.name);
  await page.getByLabel("Date of birth").fill(card.type === "child" ? "2015-03-02" : "1990-05-14");
  await page.getByLabel("Session language").selectOption(card.type === "child" ? "Spanish" : "English");
  if (card.type === "adult") {
    await page.getByLabel("Email", { exact: true }).fill(card.email);
  } else {
    await page.getByLabel("Guardian name").fill(card.guardianName);
    await page.getByLabel("Guardian email").fill(card.guardianEmail);
  }
  await page.getByRole("button", { name: "Create client card" }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}\?ok=created$/);
  return new URL(page.url()).pathname;
}

/** Дата практики через `days` днів, перенесена з вихідних на понеділок (слоти — лише в будні). */
function weekdayAhead(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Утримання клієнта на першому вільному слоті терапевта (від імені планувальника на /slots) — клієнт стає «своїм»
 * для терапевта. Шукаємо день із вільним слотом, починаючи за тиждень від сьогодні.
 */
async function holdFor(page: Page, therapist: "Therapist One" | "Therapist Two", clientName: string) {
  for (let days = 7; days < 60; days += 1) {
    await page.goto("/slots");
    await page.getByLabel("Therapist").selectOption({ label: therapist });
    await page.getByLabel("Date").fill(weekdayAhead(days));
    await page.getByLabel("Find client").fill(clientName);
    await page.getByRole("button", { name: "Show" }).click();
    await page.waitForURL(/[?&]client=/);
    const free = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Hold" }) }).first();
    if ((await free.count()) === 0) continue;
    const labels = await free.getByLabel("Client").locator("option").allTextContents();
    const label = labels.find((text) => text.startsWith(`${clientName} (`));
    expect(label, `клієнта «${clientName}» немає у виборі на /slots`).toBeTruthy();
    await free.getByLabel("Client").selectOption({ label: label! });
    await free.getByRole("button", { name: "Hold" }).click();
    await page.waitForURL(/ok=hold\.OK/);
    return;
  }
  throw new Error(`немає вільного слоту ${therapist} на 60 днів уперед`);
}

/** Рядок «Insurance: …» картки так, як його бачить людина. */
const insurance = (page: Page) => page.getByTestId("insurance");

async function setInsurance(page: Page, href: string, label: string) {
  await page.goto(href);
  await page.getByLabel("Insurance status").selectOption({ label });
  await page.getByRole("button", { name: "Save insurance status" }).click();
  await page.waitForURL(/\?ok=insurance$/);
}

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.describe("статус перевірки страхування — планувальник і адміністратор", () => {
  test.use({ storageState: "playwright/.auth/scheduler.json" });

  test(
    "AC-INS-01: scheduler1 відкриває щойно створену картку client6 — «Insurance: Not set»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-01" } },
    async ({ page }) => {
      let href = "";
      const c6 = fresh("Client Six", "c6");
      await given("картку client6 створено, і статус перевірки страхування ще ніхто не позначав", async () => {
        href = await createCard(page, { type: "adult", ...c6 });
      });
      await when("scheduler1 відкриває картку client6", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        { clause: "в картці показано «Insurance: Not set».", visible: ["рядок «Insurance: Not set» у картці"] },
        async () => {
          await expect(insurance(page)).toHaveText("Insurance: Not set");
        },
      );
    },
  );

  test(
    "AC-INS-02: scheduler1 позначає «Verified» — «Insurance status saved.» і «Insurance: Verified» після повторного відкриття",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-02" } },
    async ({ page }) => {
      let href = "";
      const c6 = fresh("Client Six", "c6");
      await given("картка client6 показує «Insurance: Not set»", async () => {
        href = await createCard(page, { type: "adult", ...c6 });
        await page.goto(href);
        await expect(insurance(page)).toHaveText("Insurance: Not set");
      });
      await when("scheduler1 позначає статус перевірки страхування «Verified»", async () => {
        await page.getByLabel("Insurance status").selectOption({ label: "Verified" });
        await page.getByRole("button", { name: "Save insurance status" }).click();
        await page.waitForURL(/\?ok=insurance$/);
      });
      await thenStep(
        page,
        {
          clause: "scheduler1 бачить повідомлення «Insurance status saved.», а картка client6 показує «Insurance: Verified»",
          visible: ["повідомлення «Insurance status saved.»", "рядок «Insurance: Verified»"],
        },
        async () => {
          await expect(page.getByRole("status")).toHaveText("Insurance status saved.");
          await expect(insurance(page)).toHaveText("Insurance: Verified");
        },
      );
      await when("scheduler1 відкриває картку client6 знову", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        {
          clause: "картка client6 показує «Insurance: Verified» і після того, як scheduler1 відкриє її знову.",
          visible: ["рядок «Insurance: Verified» у щойно відкритій картці"],
        },
        async () => {
          await expect(insurance(page)).toHaveText("Insurance: Verified");
        },
      );
    },
  );

  test(
    "AC-INS-03: admin1 змінює «Verified» на «Private pay» — admin1 і scheduler2 бачать «Insurance: Private pay»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-03" } },
    async ({ page, browser }) => {
      let href = "";
      const c7 = fresh("Client Seven", "g7");
      await given("картка client7 показує «Insurance: Verified»", async () => {
        href = await createCard(page, {
          type: "child",
          name: c7.name,
          guardianName: "Guardian Seven",
          guardianEmail: c7.email,
        });
        await setInsurance(page, href, "Verified");
        await expect(insurance(page)).toHaveText("Insurance: Verified");
      });
      const adminSeen = await asRole(browser, "admin", async (admin) => {
        await when("admin1 змінює статус перевірки страхування на «Private pay»", async () => {
          await setInsurance(admin, href, "Private pay");
        });
        await thenStep(
          admin,
          { clause: "admin1 бачить у картці «Insurance: Private pay»", visible: ["рядок «Insurance: Private pay» у admin1"] },
          async () => {
            await expect(insurance(admin)).toHaveText("Insurance: Private pay");
          },
        );
        return insurance(admin).innerText();
      });
      await asRole(browser, "scheduler2", async (s2) => {
        await when("scheduler2 відкриває картку client7", async () => {
          await s2.goto(href);
          await expect(s2.getByTestId("viewer")).toContainText("scheduler2@example.test");
        });
        await thenStep(
          s2,
          {
            clause: "і admin1, і scheduler2 бачать у картці «Insurance: Private pay».",
            visible: ["scheduler2 у шапці", "рядок «Insurance: Private pay» у scheduler2"],
            hidden: ["admin1 бачив той самий рядок (попередній кадр)"],
          },
          async () => {
            await expect(insurance(s2)).toHaveText("Insurance: Private pay");
            expect(adminSeen).toBe("Insurance: Private pay");
          },
        );
      });
    },
  );
});

test.describe("статус перевірки страхування — терапевт і без входу", () => {
  test.use({ storageState: "playwright/.auth/therapist.json" });

  /** Картка свого клієнта therapist1 зі статусом «Not accepted»: створює й позначає scheduler1. */
  async function ownClientNotAccepted(browser: Browser): Promise<string> {
    const c6 = fresh("Client Six", "c6");
    return asRole(browser, "scheduler", async (p) => {
      const href = await createCard(p, { type: "adult", ...c6 });
      await setInsurance(p, href, "Not accepted");
      await holdFor(p, "Therapist One", c6.name);
      return href;
    });
  }

  test(
    "AC-INS-04: therapist1 відкриває картку свого client6 — «Insurance: Not accepted» без можливості змінити",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-04" } },
    async ({ page, browser }) => {
      let href = "";
      await given("client6 — свій клієнт therapist1, і картка client6 показує «Insurance: Not accepted»", async () => {
        href = await ownClientNotAccepted(browser);
      });
      await when("therapist1 відкриває картку client6", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        {
          clause:
            "він бачить «Insurance: Not accepted», а змінити статус перевірки страхування в картці йому не запропоновано.",
          visible: ["рядок «Insurance: Not accepted»", "у картці немає поля «Insurance status» і кнопки «Save insurance status»"],
        },
        async () => {
          await expect(insurance(page)).toHaveText("Insurance: Not accepted");
          await expect(page.getByLabel("Insurance status")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Save insurance status" })).toHaveCount(0);
        },
      );
    },
  );

  test(
    "AC-INS-05: therapist1 напряму, оминаючи сторінки, пробує змінити статус client6 на «Verified» — scheduler1 бачить «Insurance: Not accepted»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-05" } },
    async ({ page, browser }) => {
      let href = "";
      let answer: unknown;
      await given("client6 — свій клієнт therapist1, і картка client6 показує «Insurance: Not accepted»", async () => {
        href = await ownClientNotAccepted(browser);
        // На сторінці картки therapist1 зміни статусу не запропоновано (AC-INS-04) — тому «напряму».
        await page.goto(href);
        await expect(insurance(page)).toHaveText("Insurance: Not accepted");
      });
      await when("therapist1 напряму, оминаючи сторінки застосунку, пробує змінити статус на «Verified»", async () => {
        // Напряму — Data API Supabase з власним входом therapist1, без сторінок застосунку.
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false } },
        );
        const { error } = await supabase.auth.signInWithPassword({
          email: "therapist1@example.test",
          password: process.env.UAT_PASSWORD_THERAPIST ?? process.env.DEMO_USER_PASSWORD!,
        });
        expect(error).toBeNull();
        const clientId = href.split("/").pop()!;
        answer = (await supabase.rpc("set_insurance_status", { p_client_id: clientId, p_status: "verified" })).data;
        const update = await supabase.from("clients").update({ insurance_status: "verified" }).eq("id", clientId);
        expect(update.error?.message).toMatch(/permission denied/);
        await supabase.auth.signOut();
      });
      await asRole(browser, "scheduler", async (scheduler) => {
        await scheduler.goto(href);
        await thenStep(
          scheduler,
          {
            clause: "статус не змінився: scheduler1 у картці client6 бачить «Insurance: Not accepted».",
            visible: ["scheduler1 у шапці", "рядок «Insurance: Not accepted»"],
            hidden: [
              "функція бази відповіла therapist1 «INSURANCE_FORBIDDEN»",
              "прямий update колонки — permission denied",
            ],
          },
          async () => {
            await expect(insurance(scheduler)).toHaveText("Insurance: Not accepted");
            expect(answer).toEqual({ code: "INSURANCE_FORBIDDEN" });
          },
        );
      });
    },
  );
});

test.describe("без входу", () => {
  test(
    "AC-INS-06: користувач без входу відкриває картку client6 — лише сторінка входу, scheduler1 бачить «Insurance: Verified»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-06" } },
    async ({ page, browser }) => {
      let href = "";
      await given("користувач не увійшов у застосунок, а картка client6 показує «Insurance: Verified»", async () => {
        const c6 = fresh("Client Six", "c6");
        href = await asRole(browser, "scheduler", async (p) => {
          const link = await createCard(p, { type: "adult", ...c6 });
          await setInsurance(p, link, "Verified");
          return link;
        });
      });
      await when("він відкриває картку client6 за прямим посиланням", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        {
          clause: "він бачить лише сторінку входу, статусу страхування й інших даних client6 не показано",
          visible: ["сторінка входу: «Sign in», поля «Email» і «Password»"],
          hidden: ["на сторінці немає «Insurance:», імені й email client6"],
        },
        async () => {
          await expect(page).toHaveURL(/\/login/);
          await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
          const text = await page.locator("body").innerText();
          expect(text).not.toContain("Insurance:");
          expect(text).not.toContain("Client Six");
          expect(text).not.toMatch(/@example\.test/);
        },
      );
      await asRole(browser, "scheduler", async (scheduler) => {
        await scheduler.goto(href);
        await thenStep(
          scheduler,
          {
            clause: "а scheduler1 після цього бачить у картці client6 «Insurance: Verified».",
            visible: ["scheduler1 у шапці", "рядок «Insurance: Verified»"],
          },
          async () => {
            await expect(insurance(scheduler)).toHaveText("Insurance: Verified");
          },
        );
      });
    },
  );
});
