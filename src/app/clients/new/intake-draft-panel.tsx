"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ASSISTANT_UNAVAILABLE, INTAKE_HINT, INTAKE_MAX_LENGTH, type IntakeDraft } from "@/lib/clients/intake";
import type { IntakeDraftResponse } from "@/lib/clients/intake-draft";

type Notice = { tone: "ok" | "attention"; message: string };
type RequestDraft = (text: string) => Promise<IntakeDraftResponse>;

// Запит чернетки: чернетка замінює всю форму (AC-INTAKE-01, 02, 04, 05), відмова, недоступність чи заборона — лише
// повідомлення, форма не змінюється (AC-INTAKE-06, 07, 08, 09).
function useIntakeDraft(requestDraft: RequestDraft, onDraft: (draft: IntakeDraft) => void) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();
  const draft = (text: string) =>
    startTransition(async () => {
      // Мережа чи сервер упали — для людини це той самий стан «помічник недоступний» (AC-INTAKE-08).
      const response = await requestDraft(text).catch(
        (): IntakeDraftResponse => ({ kind: "unavailable", message: ASSISTANT_UNAVAILABLE }),
      );
      if (response.kind !== "draft") return setNotice({ tone: "attention", message: response.message });
      onDraft(response.draft);
      setNotice({ tone: response.draft.status === "ok" ? "ok" : "attention", message: response.draft.message });
    });
  return { notice, pending, draft };
}

function IntakeNotice({ notice }: { notice: Notice }) {
  const Icon = notice.tone === "ok" ? CircleCheckIcon : CircleAlertIcon;
  return (
    <Alert role="status" className="animate-in fade-in-0 duration-150">
      <Icon strokeWidth={1.5} aria-hidden="true" />
      <AlertTitle>{notice.message}</AlertTitle>
    </Alert>
  );
}

// Панель «чернетка з тексту звернення» (openspec/specs/intake-draft). Стоїть поза <form> картки: текст звернення не
// йде в createClientCard і ніде не зберігається. Чернетка лише заповнює форму (onDraft), картку створює людина
// кнопкою «Create client card» (AC-INTAKE-03). Дія — пропом, як action у InsuranceSection: тести не мокають модулі.
export function IntakeDraftPanel({ requestDraft, onDraft }: { requestDraft: RequestDraft; onDraft: (draft: IntakeDraft) => void }) {
  const [text, setText] = useState("");
  const { notice, pending, draft } = useIntakeDraft(requestDraft, onDraft);
  const ButtonIcon = pending ? Loader2Icon : SparklesIcon;

  return (
    // Без aria-labelledby: інакше назва секції («…client's request») збігалася б з підписом поля «Client's request».
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">
        Draft from the client&apos;s request
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="intake-text">Client&apos;s request</Label>
        <Textarea
          id="intake-text"
          name="intake_text"
          rows={5}
          maxLength={INTAKE_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="intake-hint"
        />
        <p id="intake-hint" className="text-small text-muted-foreground">
          {INTAKE_HINT}
        </p>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={() => draft(text)} disabled={pending} aria-busy={pending || undefined}>
          <ButtonIcon className={pending ? "animate-spin" : undefined} aria-hidden="true" data-icon="inline-start" />
          Draft card from request
        </Button>
      </div>
      {notice ? <IntakeNotice notice={notice} /> : null}
    </section>
  );
}
