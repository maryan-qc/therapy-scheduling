// Синтетичні картки клієнтів для UAT на проді: дані «Дано» тести створюють самі (припущення PM у вимогах зрізів 2–3).
// Назви й адреси унікальні в межах прогону: «Client Six <прогін>-<n>», uat-<прогін>-<n>-<мітка>@example.test.
import type { Page } from "@playwright/test";

const RUN = process.env.UAT_RUN ?? "local";
let seq = 0;
/** Унікальна в межах прогону назва й адреса картки: «Client Six 2611061830-3», uat-2611061830-3-c6@example.test. */
export function fresh(label: string, tag: string) {
  seq += 1;
  return { name: `${label} ${RUN}-${seq}`, email: `uat-${RUN}-${seq}-${tag}@example.test` };
}

export type NewCard =
  | { type: "adult"; name: string; email: string }
  | { type: "child"; name: string; guardianName: string; guardianEmail: string };

/** Картка з анкети через /clients/new (від імені того, хто відкрив сторінку); повертає адресу картки. */
export async function createCard(page: Page, card: NewCard): Promise<string> {
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
