// Дія з postmortem дрілу 2026-11-25 (docs/incidents/2026-11-25-staging-login-500.md): сторінка входу рендериться без
// параметрів і з будь-яким ?error=. У дрілі коміт, що кидав TypeError на /login без ?error=, пройшов CI зеленим, бо
// жоден тест цю сторінку не рендерив, — поломку побачив лише smoke після деплою. Тепер CI червоніє ще на PR.
// Серверна сторінка рендериться в HTML (як у tests/clients/pages.test.tsx). Дію входу сторінка лише передає формі,
// тест її не викликає — бази тест не чіпає.
// Назви тестів без AC ID: технічна перевірка, а не критерій приймання.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const { default: LoginPage } = await import("@/app/login/page");

async function render(searchParams: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(searchParams) } as never));
}

describe("/login рендериться за будь-якої адреси", () => {
  it("без параметрів — форма входу (email, пароль, кнопка) і жодного повідомлення про помилку", async () => {
    const html = await render({});
    expect(html).toContain("Sign in");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('role="alert"');
  });

  it("?error=invalid і ?error=missing — відповідне повідомлення", async () => {
    expect(await render({ error: "invalid" })).toContain("Incorrect email or password.");
    expect(await render({ error: "missing" })).toContain("Enter your email and password.");
  });

  it("невідомий код, порожній чи повторений ?error= — сторінка рендериться без повідомлення", async () => {
    for (const error of ["unknown", "", ["invalid", "missing"]]) {
      const html = await render({ error });
      expect(html).toContain('type="password"');
      expect(html).not.toContain("Incorrect email or password.");
      expect(html).not.toContain("Enter your email and password.");
    }
  });
});
