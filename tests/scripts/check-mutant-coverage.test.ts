import { describe, expect, it } from "vitest";
import { accessRules } from "../../scripts/check-mutant-coverage.mjs";
import { repoRoot, runScript } from "./run-script";

// scripts/check-mutant-coverage.mjs (npm run mutation:coverage): міграція з правилами доступу має мати SQL-мутанта.
// accessRules — що вважається правилом. Регресія з рев'ю CodeRabbit: GRANT після іншої інструкції в тому самому рядку
// («BEGIN; GRANT …; COMMIT;») раніше не рахувався — регулярний вираз чіплявся лише за початок рядка.
describe("accessRules: правила доступу в тексті міграції", () => {
  it("рахує GRANT після іншої інструкції в тому самому рядку", () => {
    expect(accessRules("BEGIN; GRANT SELECT ON public.clients TO authenticated; COMMIT;")).toEqual(["grant"]);
    expect(accessRules("revoke all on public.clients from anon;grant select on public.clients to authenticated;")).toEqual([
      "grant",
    ]);
  });

  it("рахує GRANT на початку рядка, зокрема з відступом і будь-яким регістром", () => {
    const sql = [
      "  grant select on public.clients to authenticated;",
      "\tGRANT UPDATE (name, email) ON public.clients TO authenticated;",
      "Grant execute on function private.is_staff() to authenticated;",
    ].join("\n");
    expect(accessRules(sql)).toEqual(["grant", "grant", "grant"]);
  });

  it("рахує create policy і alter policy (пробіли й регістр нормалізовано)", () => {
    const sql = [
      "create policy clients_select on public.clients for select to authenticated using (true);",
      "ALTER   POLICY clients_select ON public.clients USING ((select auth.uid()) is not null);",
      "CREATE\n  POLICY holds_insert on public.slot_holds for insert to authenticated with check (true);",
    ].join("\n");
    expect(accessRules(sql)).toEqual(["create policy", "alter policy", "create policy"]);
  });

  it("рахує security definer, зокрема через перенесення рядка", () => {
    const sql = [
      "create function private.is_staff() returns boolean language sql stable",
      "  SECURITY",
      "  DEFINER set search_path = '' as $$ select true $$;",
      "alter function private.is_staff() security definer;",
    ].join("\n");
    expect(accessRules(sql)).toEqual(["security definer", "security definer"]);
  });

  it("міграція лише з коментарями, значенням enum і сидом — правил немає", () => {
    const sql = [
      "-- Ролі: нове значення enum, правил доступу немає.",
      "alter type public.app_role add value if not exists 'scheduler';",
      "/* Сид синтетичних даних PM */",
      "insert into public.therapists (name, email) values ('Therapist One', 'therapist1@example.test');",
    ].join("\n");
    expect(accessRules(sql)).toEqual([]);
    expect(accessRules("")).toEqual([]);
  });

  it("не рахує «grant» усередині назв (granted_at, grantee) і слова «grants» у коментарі", () => {
    const sql = [
      "create table public.access_log (",
      "  granted_at timestamptz not null default now(),",
      "  grantee uuid not null",
      ");",
      "-- grants for this table are added by the next migration",
      "update public.access_log set granted_at = now(); grants_seen_count := 0;",
      "comment on column public.access_log.granted_at is 'when access was granted';",
    ].join("\n");
    expect(accessRules(sql)).toEqual([]);
  });
});

describe("mutation:coverage на справжньому репозиторії", () => {
  it("кожна міграція з правилами доступу має мутанта або причину винятку — код 0 і «mutation:coverage — OK»", () => {
    const { code, out } = runScript("check-mutant-coverage.mjs", repoRoot);
    expect(out).toContain("mutation:coverage — OK");
    expect(code).toBe(0);
  });
});
