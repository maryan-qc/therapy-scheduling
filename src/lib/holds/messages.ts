// Коди функцій бази → повідомлення, дослівно як у критеріях PM (requirements/2-planuvalnyk-utrymuie-slot-terapevta.md).
import type { ConfirmCode, HoldCode } from "./rules";

export const HOLD_MESSAGES: Record<HoldCode, string> = {
  OK: "Slot held.",
  HOLD_FORBIDDEN: "Only schedulers and admins can hold slots.",
  SLOT_STARTED: "This slot has already started and cannot be held.",
  SLOT_UNAVAILABLE: "This slot is no longer available.",
  CLIENT_BUSY: "This client already has a hold or session at this time.",
  NOT_FOUND: "This slot is no longer available.",
};

export const CONFIRM_MESSAGES: Record<ConfirmCode, string> = {
  OK: "Hold confirmed.",
  CONFIRM_FORBIDDEN: "Only schedulers and admins can confirm holds.",
  ALREADY_CONFIRMED: "This hold is already confirmed.",
  HOLD_EXPIRED: "This hold has expired. Hold the slot again.",
  SLOT_STARTED: "This slot has already started and cannot be confirmed.",
  NOT_FOUND: "This hold is no longer available.",
};

export const HOLD_CODES = Object.keys(HOLD_MESSAGES) as HoldCode[];
export const CONFIRM_CODES = Object.keys(CONFIRM_MESSAGES) as ConfirmCode[];
