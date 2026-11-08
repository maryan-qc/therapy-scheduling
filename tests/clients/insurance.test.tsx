// Рядок «Insurance: <статус>» і розділ картки за роллю (openspec/specs/insurance-status). Дані й права — tests/db/.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InsuranceSection } from "@/app/clients/[id]/insurance-section";
import { INSURANCE_CHOICES, insuranceLine, insuranceResult } from "@/lib/clients/insurance";

const save = async () => {};

const html = (status: string, canEdit: boolean) =>
  renderToStaticMarkup(<InsuranceSection clientId="c6" status={status} canEdit={canEdit} action={save} />);

describe("статус перевірки страхування в картці", () => {
  it("AC-INS-01: без позначки — «Insurance: Not set»", () => {
    expect(insuranceLine("not_set")).toBe("Insurance: Not set");
    expect(html("not_set", true)).toContain("Insurance: Not set");
  });

  it("AC-INS-02: позначити можна лише «Verified», «Not accepted», «Private pay»; «Not set» серед них немає", () => {
    expect(INSURANCE_CHOICES).toEqual(["verified", "not_accepted", "private_pay"]);
    expect(insuranceLine("verified")).toBe("Insurance: Verified");
    expect(insuranceResult("OK")).toBe("OK");
    expect(insuranceResult("whatever")).toBe("SAVE_FAILED");
  });

  it("AC-INS-03: «Private pay» — рядок «Insurance: Private pay»", () => {
    expect(insuranceLine("private_pay")).toBe("Insurance: Private pay");
  });

  it("AC-INS-04: терапевт бачить «Insurance: Not accepted» без форми; планувальнику форму запропоновано", () => {
    const therapist = html("not_accepted", false);
    expect(therapist).toContain("Insurance: Not accepted");
    expect(therapist).not.toContain("<form");
    expect(therapist).not.toContain("Save insurance status");
    expect(html("not_accepted", true)).toContain("Save insurance status");
  });
});
