// Вхід кожної ролі один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Тести ролей беруть стан через test.use({ storageState: "playwright/.auth/<role>.json" }).
// У цьому проєкті запис вимкнено (playwright.config.ts: setup — video, trace і screenshot "off"): тут вводиться пароль.
//
// Змінні з паролями (лише назви; значення — у .env.local локально або в secrets CI, ніколи в коді):
//   DEMO_USER_PASSWORD           — спільний пароль акаунтів із supabase/demo-users.json (npm run users:demo);
//   UAT_PASSWORD_<РОЛЬ>          — необов'язково: окремий пароль для ролі, напр. UAT_PASSWORD_ADMIN.
//
// Джерело: демо-репо курсу, tests/e2e/auth.setup.ts (тег ws8-03-uat) через materials/uat. ROLES — наші: роль → адреса
// акаунта на проді (D0.5, *@example.test).
import { expect, test as setup, type Page } from "@playwright/test";
import { signIn } from "./support/uat";

// Наше: лише акаунти трьох AC WS8 (адміністратора UAT не бере — найменші права). Ключ — назва файлу стану.
// signedIn — ознака входу: шапка (Nav) з email того, хто увійшов (data-testid="viewer"); у користувача без ролі шапки
// немає — лише повідомлення на головній (data-testid="no-role").
const viewer = (email: string) => (page: Page) => page.getByTestId("viewer").filter({ hasText: email });
const ROLES = {
  therapist: { email: "therapist1@example.test", signedIn: viewer("therapist1@example.test") }, // AC-CARD-05
  therapist2: { email: "therapist2@example.test", signedIn: viewer("therapist2@example.test") }, // «Дано» AC-CARD-05
  scheduler: { email: "scheduler1@example.test", signedIn: viewer("scheduler1@example.test") }, // AC-CARD-12
  scheduler2: { email: "scheduler2@example.test", signedIn: viewer("scheduler2@example.test") }, // AC-INS-03
  admin: { email: "admin1@example.test", signedIn: viewer("admin1@example.test") }, // AC-INS-03
  norole: { email: "newuser1@example.test", signedIn: (page: Page) => page.getByTestId("no-role") }, // AC-CARD-11
} as const;

for (const [role, { email, signedIn }] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${role.toUpperCase()}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${role.toUpperCase()}`).toBeTruthy();
    await signIn(page, email, password!);
    await expect(signedIn(page)).toBeVisible();
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}
