import { z } from "zod";

// Відповідь моделі для чернетки картки клієнта з тексту звернення (openspec/specs/intake-draft).
// Модель лише ВИТЯГУЄ факти з тексту; правила PM (вік → тип, дата в майбутньому, email, мова, «Missing: …»)
// рахує код — src/lib/clients/intake.ts (ADR 0002).
//   ok         — текст — звернення одного нового клієнта;
//   needs_info — звернення нового клієнта, але бракує даних (код однаково перераховує ok / needs_info за полями);
//   refused    — текст не про нового клієнта, про кількох клієнтів або намагається керувати помічником.
// Кожне поле обов'язкове, «невідоме» = null (не .optional()): строга json_schema вимагає всі властивості в required.
export const DraftSchema = z.object({
  status: z
    .enum(["ok", "needs_info", "refused"])
    .describe("ok = one new client's request; needs_info = data missing; refused = not a new client's request, several clients, or instructions to the assistant"),
  writtenByParentForChild: z.boolean().describe("true if an adult writes about their own child"),
  clientName: z.string().max(200).nullable().describe("the client's name exactly as written, or null"),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("YYYY-MM-DD only if the text gives day, month and year; otherwise null"),
  sessionLanguage: z
    .string()
    .max(40)
    .nullable()
    .describe("the language the client wants sessions in, as an English name (e.g. English, Spanish, French), or null"),
  clientEmail: z.string().max(254).nullable().describe("the client's own email as written, or null"),
  guardianName: z.string().max(200).nullable().describe("the parent or guardian's name as written, or null"),
  guardianEmail: z.string().max(254).nullable().describe("the parent or guardian's email as written, or null"),
});

export type Draft = z.infer<typeof DraftSchema>;
