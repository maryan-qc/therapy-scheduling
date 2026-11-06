// Що бачить людина в документах згоди (openspec/specs/consent-documents): рядок підписів, стан, текст документа й
// розділ картки за роллю. Хто що може і скільки документів — tests/db/consent-documents.test.ts.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsentSection } from "@/app/clients/[id]/consent-section";
import { documentState, documentText, signaturesLine, type ConsentDocumentRow } from "@/lib/clients/consent";
import { CONFIRM_MESSAGES } from "@/lib/holds/messages";

const doc = (kind: string, position: number, signed_at: string | null = null): ConsentDocumentRow => ({
  id: `d${position}`,
  client_id: "c6",
  kind,
  position,
  prepared_at: "2026-11-04T17:00:00Z",
  signed_at,
});
const adultSet = (signed: (string | null)[] = [null, null]) => [
  doc("consent_to_treatment", 1, signed[0]),
  doc("cancellation_policy", 2, signed[1]),
];
const noop = async () => {};
const section = (documents: ConsentDocumentRow[], canEdit: boolean) =>
  renderToStaticMarkup(
    <ConsentSection clientId="c6" documents={documents} canEdit={canEdit} prepare={noop} sign={noop} />,
  );

describe("документи згоди в картці", () => {
  it("AC-DOC-01: документів ще не формували — «No consent documents yet.» і жодного документа", () => {
    expect(signaturesLine([])).toBe("No consent documents yet.");
    const html = section([], true);
    expect(html).toContain("No consent documents yet.");
    expect(html).toContain("Prepare consent documents");
    expect(html).not.toContain("Consent to treatment");
  });

  it("AC-DOC-02: два документи «Not signed» і «Missing signatures: Consent to treatment, Cancellation policy acknowledgement»", () => {
    expect(signaturesLine(adultSet())).toBe(
      "Missing signatures: Consent to treatment, Cancellation policy acknowledgement",
    );
    // Порядок набору — і коли база віддала документи в іншому порядку.
    expect(signaturesLine([...adultSet()].reverse())).toBe(
      "Missing signatures: Consent to treatment, Cancellation policy acknowledgement",
    );
    const html = section(adultSet(), true);
    expect(html.match(/Not signed/g)).toHaveLength(2);
    expect(html).not.toContain("Prepare consent documents");
  });

  it("AC-DOC-03: для дитини третій документ — «Release of information»", () => {
    const html = section([...adultSet(), doc("release_of_information", 3)], true);
    expect(html).toContain("Release of information");
    expect(html.match(/Not signed/g)).toHaveLength(3);
  });

  it("AC-DOC-04: «Release of information» — Client, Guardian і Prepared: 2026-11-04", () => {
    const text = documentText(doc("release_of_information", 3), {
      name: "Client Seven",
      client_type: "child",
      guardian_name: "Guardian Seven",
    });
    expect(text.title).toBe("Release of information");
    expect(text.lines).toEqual(["Client: Client Seven", "Guardian: Guardian Seven", "Prepared: 2026-11-04"]);
    expect(text.body.length).toBeGreaterThan(0);
    // У дорослого рядка «Guardian» немає.
    expect(
      documentText(doc("consent_to_treatment", 1), { name: "Client Six", client_type: "adult", guardian_name: null })
        .lines,
    ).toEqual(["Client: Client Six", "Prepared: 2026-11-04"]);
  });

  it("AC-DOC-05: підписано о 10:15 — «Signed 2026-11-04 10:15», лишився «Cancellation policy acknowledgement»", () => {
    const docs = adultSet(["2026-11-04T18:15:00Z", null]);
    expect(documentState(docs[0])).toBe("Signed 2026-11-04 10:15");
    expect(documentState(docs[1])).toBe("Not signed");
    expect(signaturesLine(docs)).toBe("Missing signatures: Cancellation policy acknowledgement");
  });

  it("AC-DOC-06: підписано всі — «All consent documents signed.» замість «Missing signatures», кнопок немає", () => {
    const docs = adultSet(["2026-11-04T18:15:00Z", "2026-11-04T19:00:00Z"]);
    expect(signaturesLine(docs)).toBe("All consent documents signed.");
    const html = section(docs, true);
    expect(html).toContain("All consent documents signed.");
    expect(html).not.toContain("Missing signatures");
    expect(html).not.toContain("Mark as signed");
  });

  it("AC-DOC-07: відмова підтвердження — «Sign all consent documents before confirming.»", () => {
    expect(CONFIRM_MESSAGES.UNSIGNED_DOCUMENTS).toBe("Sign all consent documents before confirming.");
  });

  it("AC-DOC-09: терапевт бачить документи й стан без «Prepare» і «Mark as signed»; персоналу кнопки є", () => {
    const therapist = section(adultSet(), false);
    expect(therapist).toContain("Consent to treatment");
    expect(therapist).toContain("Not signed");
    expect(therapist).not.toContain("Mark as signed");
    expect(therapist).not.toContain("<form");
    expect(section([], false)).not.toContain("Prepare consent documents");
    expect(section(adultSet(), true).match(/Mark as signed/g)).toHaveLength(2);
  });
});
