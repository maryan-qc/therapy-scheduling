import { describe, expect, it } from "vitest";
import { matchesClient } from "@/lib/clients/search";
import { clientContact, STAFF_PAGE_ONLY, staffPageError } from "@/lib/holds/types";

const clientSeven = { name: "Client Seven", email: null, guardian_email: "guardian7@example.test" };
const clientSix = { name: "Client Six", email: "client6@example.test", guardian_email: null };

// Пошук клієнта під час утримання слоту на /slots (припущення PM #19, Sofiia-pm/therapy-scheduling-spec#31).
describe("пошук клієнта під час утримання", () => {
  it("AC-CARD-02: client7 знаходять за email опікуна guardian7@example.test, і біля нього показано email опікуна", () => {
    expect(matchesClient(clientSeven, "guardian7@example.test")).toBe(true);
    expect(matchesClient(clientSeven, " GUARDIAN7@Example.test ")).toBe(true);
    expect(matchesClient(clientSix, "guardian7@example.test")).toBe(false);
    expect(clientContact(clientSeven)).toBe("guardian: guardian7@example.test");
  });

  it("AC-CARD-01: дорослого знаходять за ім'ям або email; порожній пошук — усі клієнти", () => {
    expect(matchesClient(clientSix, "client six")).toBe(true);
    expect(matchesClient(clientSix, "client6@")).toBe(true);
    expect(matchesClient(clientSeven, "")).toBe(true);
  });
});

describe("сторінки слотів і утримань планувальника", () => {
  it("AC-HOLD-44: терапевт — «Only schedulers and admins can view this page.», планувальник і адміністратор — без відмови", () => {
    expect(staffPageError("therapist")).toBe("Only schedulers and admins can view this page.");
    expect(staffPageError(null)).toBe(STAFF_PAGE_ONLY);
    expect(staffPageError("scheduler")).toBeNull();
    expect(staffPageError("admin")).toBeNull();
  });
});
