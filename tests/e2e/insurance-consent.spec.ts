// UAT зрізу 3 (WS9): статус перевірки страхування (AC-INS-01…06) і документи згоди (AC-DOC-01…11). Текст AC —
// requirements/33-planuvalnyk-poznachaie-status-strakhuvannia.md і requirements/34-planuvalnyk-formuie-dokumenty-zghody.md.
// Дані «Дано» тести створюють самі (припущення PM): статус «Not set» не повертається, а документи формують один раз на
// картку, тож кожен тест бере свіжу синтетичну картку «… <прогін>» з адресою uat-<прогін>-…@example.test, а «свого
// клієнта» робить утриманням на вільному слоті через /slots. Картки, утримання й сеанси лишаються на проді як
// синтетичні дані прогону (docs/qa/uat/).
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

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
const summary = (page: Page) => page.getByTestId("consent-summary");
const documents = (page: Page) => page.getByTestId("consent-documents").getByRole("listitem");

async function setInsurance(page: Page, href: string, label: string) {
  await page.goto(href);
  await page.getByLabel("Insurance status").selectOption({ label });
  await page.getByRole("button", { name: "Save insurance status" }).click();
  await page.waitForURL(/\?ok=insurance$/);
}

async function prepareDocuments(page: Page, href: string) {
  await page.goto(href);
  await page.getByRole("button", { name: "Prepare consent documents" }).click();
  await expect(page.getByTestId("consent-documents")).toBeVisible();
}

/** Позначити документ підписаним у картці (від імені того, хто відкрив сторінку). */
async function signInCard(page: Page, href: string, title: string) {
  await page.goto(href);
  await documents(page).filter({ hasText: title }).getByRole("button", { name: "Mark as signed" }).click();
  await expect(documents(page).filter({ hasText: title })).toContainText("Signed ");
}

/** Адреса документа за назвою — з картки. */
async function documentHref(page: Page, href: string, title: string): Promise<string> {
  await page.goto(href);
  const link = await documents(page).getByRole("link", { name: title, exact: true }).getAttribute("href");
  expect(link).toMatch(/^\/clients\/[0-9a-f-]{36}\/documents\/[0-9a-f-]{36}$/);
  return link!;
}

/** Стан документа так, як його бачить планувальник на сторінці документа. */
const documentStateFor = (browser: Browser, link: string) =>
  asRole(browser, "scheduler", async (p) => {
    await p.goto(link);
    return p.getByTestId("consent-state").innerText();
  });

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

  test(
    "AC-DOC-11: користувач без входу відкриває документ «Consent to treatment» client6 — лише сторінка входу, стан не змінився",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-11" } },
    async ({ page, browser }) => {
      let link = "";
      let before = "";
      await given("користувач не увійшов у застосунок, а для client6 сформовано документи згоди", async () => {
        const c6 = fresh("Client Six", "c6");
        link = await asRole(browser, "scheduler", async (p) => {
          const href = await createCard(p, { type: "adult", ...c6 });
          await prepareDocuments(p, href);
          return documentHref(p, href, "Consent to treatment");
        });
        before = await documentStateFor(browser, link);
      });
      await when("він відкриває документ «Consent to treatment» client6 за прямим посиланням", async () => {
        await page.goto(link);
      });
      await thenStep(
        page,
        {
          clause: "він бачить лише сторінку входу, тексту документа й даних client6 не показано, і стан документа не змінився.",
          visible: ["сторінка входу: «Sign in», поля «Email» і «Password»"],
          hidden: ["на сторінці немає тексту документа й даних client6", "стан документа в scheduler1 до й після однаковий"],
        },
        async () => {
          await expect(page).toHaveURL(/\/login/);
          await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
          const text = await page.locator("body").innerText();
          expect(text).not.toContain("Consent to treatment");
          expect(text).not.toContain("Client Six");
          expect(await documentStateFor(browser, link)).toBe(before);
        },
      );
    },
  );
});

test.describe("документи згоди — планувальник", () => {
  test.use({ storageState: "playwright/.auth/scheduler.json" });

  test(
    "AC-DOC-01: scheduler1 відкриває картку client6 без документів — «No consent documents yet.» і жодного документа",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-01" } },
    async ({ page }) => {
      let href = "";
      await given("картку client6 (тип «Adult») створено, і документів згоди для неї ще не формували", async () => {
        href = await createCard(page, { type: "adult", ...fresh("Client Six", "c6") });
      });
      await when("scheduler1 відкриває картку client6", async () => {
        await page.goto(href);
      });
      await thenStep(
        page,
        {
          clause: "в картці показано повідомлення «No consent documents yet.» і жодного документа.",
          visible: ["«No consent documents yet.» у розділі «Consent documents»", "списку документів немає"],
        },
        async () => {
          await expect(summary(page)).toHaveText("No consent documents yet.");
          await expect(page.getByTestId("consent-documents")).toHaveCount(0);
        },
      );
    },
  );

  test(
    "AC-DOC-02: scheduler1 формує документи для client6 (Adult) — два «Not signed» і «Missing signatures: …»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-02" } },
    async ({ page }) => {
      let href = "";
      await given("для client6 (тип «Adult») документів згоди ще немає", async () => {
        href = await createCard(page, { type: "adult", ...fresh("Client Six", "c6") });
        await page.goto(href);
        await expect(summary(page)).toHaveText("No consent documents yet.");
      });
      await when("scheduler1 формує документи згоди для client6", async () => {
        await page.getByRole("button", { name: "Prepare consent documents" }).click();
        await expect(page.getByTestId("consent-documents")).toBeVisible();
      });
      await thenStep(
        page,
        {
          clause:
            "в картці client6 показано рівно два документи — «Consent to treatment» і «Cancellation policy acknowledgement», кожен зі станом «Not signed», і рядок «Missing signatures: Consent to treatment, Cancellation policy acknowledgement».",
          visible: [
            "рівно два документи: «Consent to treatment» і «Cancellation policy acknowledgement»",
            "у кожного — «Not signed»",
            "рядок «Missing signatures: Consent to treatment, Cancellation policy acknowledgement»",
          ],
        },
        async () => {
          await expect(documents(page)).toHaveCount(2);
          await expect(documents(page).getByRole("link")).toHaveText([
            "Consent to treatment",
            "Cancellation policy acknowledgement",
          ]);
          await expect(page.getByTestId("consent-state")).toHaveText(["Not signed", "Not signed"]);
          await expect(summary(page)).toHaveText(
            "Missing signatures: Consent to treatment, Cancellation policy acknowledgement",
          );
        },
      );
    },
  );

  test(
    "AC-DOC-03: scheduler1 формує документи для client7 (Child) — три «Not signed»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-03" } },
    async ({ page }) => {
      let href = "";
      await given("для client7 (тип «Child», опікун «Guardian Seven») документів згоди ще немає", async () => {
        const c7 = fresh("Client Seven", "g7");
        href = await createCard(page, { type: "child", name: c7.name, guardianName: "Guardian Seven", guardianEmail: c7.email });
        await page.goto(href);
        await expect(summary(page)).toHaveText("No consent documents yet.");
      });
      await when("scheduler1 формує документи згоди для client7", async () => {
        await page.getByRole("button", { name: "Prepare consent documents" }).click();
        await expect(page.getByTestId("consent-documents")).toBeVisible();
      });
      await thenStep(
        page,
        {
          clause:
            "в картці client7 показано рівно три документи — «Consent to treatment», «Cancellation policy acknowledgement» і «Release of information», кожен зі станом «Not signed».",
          visible: [
            "рівно три документи: «Consent to treatment», «Cancellation policy acknowledgement», «Release of information»",
            "у кожного — «Not signed»",
          ],
        },
        async () => {
          await expect(documents(page).getByRole("link")).toHaveText([
            "Consent to treatment",
            "Cancellation policy acknowledgement",
            "Release of information",
          ]);
          await expect(page.getByTestId("consent-state")).toHaveText(["Not signed", "Not signed", "Not signed"]);
        },
      );
    },
  );

  test(
    "AC-DOC-04: scheduler1 відкриває «Release of information» client7 — заголовок, Client, Guardian і Prepared",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-04" } },
    async ({ page }) => {
      let link = "";
      let name = "";
      const prepared = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
      await given(`scheduler1 сформував документи згоди для client7 (тип «Child», опікун «Guardian Seven») ${prepared}`, async () => {
        const c7 = fresh("Client Seven", "g7");
        name = c7.name;
        const href = await createCard(page, {
          type: "child",
          name,
          guardianName: "Guardian Seven",
          guardianEmail: c7.email,
        });
        await prepareDocuments(page, href);
        link = await documentHref(page, href, "Release of information");
      });
      await when("scheduler1 відкриває документ «Release of information» client7", async () => {
        await page.goto(link);
      });
      await thenStep(
        page,
        {
          clause: `він бачить документ англійською із заголовком «Release of information», рядками «Client: ${name}», «Guardian: Guardian Seven» і «Prepared: ${prepared}».`,
          visible: [
            "заголовок «Release of information»",
            `рядок «Client: ${name}»`,
            "рядок «Guardian: Guardian Seven»",
            `рядок «Prepared: ${prepared}»`,
            "текст документа англійською",
          ],
        },
        async () => {
          await expect(page.getByRole("heading", { level: 1, name: "Release of information" })).toBeVisible();
          const text = page.getByTestId("consent-document");
          await expect(text).toContainText(`Client: ${name}`);
          await expect(text).toContainText("Guardian: Guardian Seven");
          await expect(text).toContainText(`Prepared: ${prepared}`);
        },
      );
    },
  );

  test(
    "AC-DOC-05: scheduler1 позначає «Consent to treatment» підписаним — «Signed <дата> <час>», лишився «Cancellation policy acknowledgement»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-05" } },
    async ({ page }) => {
      let href = "";
      let before = 0;
      await given("обидва документи згоди client6 мають стан «Not signed»", async () => {
        href = await createCard(page, { type: "adult", ...fresh("Client Six", "c6") });
        await prepareDocuments(page, href);
        await expect(page.getByTestId("consent-state")).toHaveText(["Not signed", "Not signed"]);
      });
      await when("scheduler1 позначає «Consent to treatment» підписаним", async () => {
        before = Date.now();
        await documents(page).filter({ hasText: "Consent to treatment" }).getByRole("button", { name: "Mark as signed" }).click();
        await expect(page.getByTestId("consent-state").first()).toContainText("Signed ");
      });
      await thenStep(
        page,
        {
          clause:
            "«Consent to treatment» показано зі станом «Signed РРРР-ММ-ДД ГГ:ХХ» (час позначки), а рядок у картці — «Missing signatures: Cancellation policy acknowledgement».",
          visible: [
            "у «Consent to treatment» — «Signed» з датою й часом позначки",
            "у «Cancellation policy acknowledgement» — «Not signed»",
            "рядок «Missing signatures: Cancellation policy acknowledgement»",
          ],
          hidden: ["дата й час у стані — час позначки в поясі America/Los_Angeles (± 1 хв)"],
        },
        async () => {
          const state = await page.getByTestId("consent-state").first().innerText();
          expect(state).toMatch(/^Signed \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
          const fmt = (ms: number) =>
            new Intl.DateTimeFormat("sv-SE", {
              timeZone: "America/Los_Angeles",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).format(new Date(ms));
          expect([fmt(before - 60_000), fmt(before), fmt(Date.now())]).toContain(state.slice("Signed ".length));
          await expect(page.getByTestId("consent-state").nth(1)).toHaveText("Not signed");
          await expect(summary(page)).toHaveText("Missing signatures: Cancellation policy acknowledgement");
        },
      );
    },
  );

  test(
    "AC-DOC-06: scheduler2 позначає «Cancellation policy acknowledgement» — обидва «Signed …» і «All consent documents signed.»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-06" } },
    async ({ page, browser }) => {
      let href = "";
      await given("«Consent to treatment» client6 має стан «Signed», а «Cancellation policy acknowledgement» — «Not signed»", async () => {
        href = await createCard(page, { type: "adult", ...fresh("Client Six", "c6") });
        await prepareDocuments(page, href);
        await signInCard(page, href, "Consent to treatment");
        await expect(page.getByTestId("consent-state").nth(1)).toHaveText("Not signed");
      });
      await asRole(browser, "scheduler2", async (s2) => {
        await when("scheduler2 позначає «Cancellation policy acknowledgement» підписаним", async () => {
          await signInCard(s2, href, "Cancellation policy acknowledgement");
        });
        await thenStep(
          s2,
          {
            clause:
              "обидва документи показано зі станом «Signed …», а замість рядка «Missing signatures» картка показує «All consent documents signed.».",
            visible: ["scheduler2 у шапці", "у обох документів — «Signed …»", "«All consent documents signed.»"],
            hidden: ["рядка «Missing signatures» на сторінці немає"],
          },
          async () => {
            await expect(s2.getByTestId("consent-state")).toHaveText([/^Signed /, /^Signed /]);
            await expect(summary(s2)).toHaveText("All consent documents signed.");
            await expect(s2.getByText("Missing signatures")).toHaveCount(0);
          },
        );
      });
    },
  );

  /** Рядок утримання client6 на /holds: статус і «Held until». */
  const holdRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

  test(
    "AC-DOC-07: scheduler1 пробує підтвердити утримання client6 з непідписаним документом — «Sign all consent documents before confirming.», «Held»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-07" } },
    async ({ page }) => {
      const c6 = fresh("Client Six", "c6");
      let heldUntil = "";
      await given(
        "client6 має утримання зі статусом «Held» у therapist1, для client6 сформовано документи згоди, і «Cancellation policy acknowledgement» має стан «Not signed»",
        async () => {
          const href = await createCard(page, { type: "adult", ...c6 });
          await holdFor(page, "Therapist One", c6.name);
          await prepareDocuments(page, href);
          await signInCard(page, href, "Consent to treatment");
          await page.goto("/holds");
          await expect(holdRow(page, c6.name).getByTestId("hold-status")).toContainText("Held");
          heldUntil = (await holdRow(page, c6.name).getByRole("cell").nth(4).innerText()).slice(0, 16);
        },
      );
      await when("scheduler1 пробує підтвердити це утримання", async () => {
        await holdRow(page, c6.name).getByRole("button", { name: "Confirm" }).click();
        await page.waitForURL(/error=confirm\.UNSIGNED_DOCUMENTS/);
      });
      await thenStep(
        page,
        {
          clause:
            "утримання не підтверджується, scheduler1 бачить повідомлення «Sign all consent documents before confirming.», а утримання лишається зі статусом «Held» і тим самим «Held until».",
          visible: [
            "повідомлення «Sign all consent documents before confirming.»",
            `рядок утримання ${c6.name} зі статусом «Held»`,
            `«Held until» ${heldUntil}`,
          ],
        },
        async () => {
          await expect(page.getByRole("alert")).toHaveText("Sign all consent documents before confirming.");
          await expect(holdRow(page, c6.name).getByTestId("hold-status")).toContainText("Held");
          await expect(holdRow(page, c6.name).getByRole("cell").nth(4)).toContainText(heldUntil);
        },
      );
    },
  );

  test(
    "AC-DOC-08: усі документи client6 підписано — scheduler1 підтверджує утримання, слот «Confirmed» без «Held until»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-08" } },
    async ({ page }) => {
      const c6 = fresh("Client Six", "c6");
      await given(
        "client6 має утримання «Held» у therapist1, утримання ще не прострочене й слот ще не почався, а всі документи згоди client6 мають стан «Signed»",
        async () => {
          const href = await createCard(page, { type: "adult", ...c6 });
          await holdFor(page, "Therapist One", c6.name);
          await prepareDocuments(page, href);
          await signInCard(page, href, "Consent to treatment");
          await signInCard(page, href, "Cancellation policy acknowledgement");
          await expect(summary(page)).toHaveText("All consent documents signed.");
        },
      );
      const row = () => page.getByRole("row").filter({ hasText: c6.name });
      await when("scheduler1 підтверджує це утримання", async () => {
        await page.goto("/holds");
        const holdsRow = page.getByRole("row").filter({ hasText: c6.name }).first();
        await holdsRow.getByRole("button", { name: "Confirm" }).click();
        await page.waitForURL(/ok=confirm\.OK/);
      });
      await thenStep(
        page,
        {
          clause: "слот має статус «Confirmed», а «Held until» більше не показано.",
          visible: ["повідомлення «Hold confirmed.»", `утримання ${c6.name} зникло зі списку утримань (підтверджене)`],
          hidden: ["у списку утримань немає рядка client6 з «Held until»"],
        },
        async () => {
          await expect(page.getByRole("status")).toHaveText("Hold confirmed.");
          await expect(row()).toHaveCount(0);
        },
      );
    },
  );
});

test.describe("документи згоди — терапевт", () => {
  test.use({ storageState: "playwright/.auth/therapist.json" });

  test(
    "AC-DOC-09: therapist1 відкриває «Consent to treatment» свого client6 — документ і «Not signed», без позначки підпису",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-09" } },
    async ({ page, browser }) => {
      let link = "";
      await given("client6 — свій клієнт therapist1, і документ «Consent to treatment» client6 має стан «Not signed»", async () => {
        const c6 = fresh("Client Six", "c6");
        link = await asRole(browser, "scheduler", async (p) => {
          const href = await createCard(p, { type: "adult", ...c6 });
          await holdFor(p, "Therapist One", c6.name);
          await prepareDocuments(p, href);
          return documentHref(p, href, "Consent to treatment");
        });
      });
      await when("therapist1 відкриває цей документ за прямим посиланням", async () => {
        await page.goto(link);
      });
      await thenStep(
        page,
        {
          clause:
            "він бачить документ і стан «Not signed», позначити його підписаним йому не запропоновано — замість цього він бачить повідомлення «Only schedulers and admins can mark documents as signed.»",
          visible: [
            "заголовок «Consent to treatment» і текст документа",
            "«Status: Not signed»",
            "повідомлення «Only schedulers and admins can mark documents as signed.»",
            "кнопки «Mark as signed» немає",
          ],
        },
        async () => {
          await expect(page.getByRole("heading", { level: 1, name: "Consent to treatment" })).toBeVisible();
          await expect(page.getByTestId("consent-state")).toHaveText("Status: Not signed");
          await expect(page.getByRole("status")).toHaveText("Only schedulers and admins can mark documents as signed.");
          await expect(page.getByRole("button", { name: "Mark as signed" })).toHaveCount(0);
        },
      );
      await thenStep(
        page,
        {
          clause: "а scheduler1 після цього бачить у документа той самий стан «Not signed».",
          visible: [],
          hidden: ["стан документа в scheduler1 — «Status: Not signed»"],
        },
        async () => {
          expect(await documentStateFor(browser, link)).toBe("Status: Not signed");
        },
      );
    },
  );

  test(
    "AC-DOC-10: therapist1 відкриває «Consent to treatment» client9 (свій лише для therapist2) — «You don't have access to this client.»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOC-10" } },
    async ({ page, browser }) => {
      let link = "";
      let before = "";
      let name = "";
      await given("client9 — свій клієнт лише для therapist2, і для client9 сформовано документи згоди", async () => {
        const c9 = fresh("Client Nine", "c9");
        name = c9.name;
        link = await asRole(browser, "scheduler", async (p) => {
          const href = await createCard(p, { type: "adult", ...c9 });
          await holdFor(p, "Therapist Two", c9.name);
          await prepareDocuments(p, href);
          return documentHref(p, href, "Consent to treatment");
        });
        before = await documentStateFor(browser, link);
      });
      await when("therapist1 відкриває документ «Consent to treatment» client9 за прямим посиланням", async () => {
        await page.goto(link);
      });
      await thenStep(
        page,
        {
          clause:
            "therapist1 бачить повідомлення «You don't have access to this client.», жодного тексту документа чи даних client9 не показано, а стан документа не змінився.",
          visible: ["повідомлення «You don't have access to this client.»"],
          hidden: [
            "на сторінці немає заголовка й тексту документа, імені та email client9",
            "стан документа в scheduler1 до й після однаковий",
          ],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("alert")).toHaveText("You don't have access to this client.");
          await expect(page.getByTestId("consent-document")).toHaveCount(0);
          const text = await page.locator("body").innerText();
          expect(text).not.toContain(name);
          expect(text).not.toContain("Consent to treatment");
          expect(text).not.toMatch(/uat-[\w-]+@example\.test/);
          expect(await documentStateFor(browser, link)).toBe(before);
        },
      );
    },
  );
});
