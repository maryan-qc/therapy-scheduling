"use client";

import { CircleAlertIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  CARD_MESSAGES,
  EMPTY_CARD_FORM,
  SESSION_LANGUAGES,
  type CardErrorCode,
  type CardForm,
} from "@/lib/clients/card";
import { createClientCard, type CardFormState } from "../actions";

type FieldName = keyof CardForm;

// Біля якого поля показати помилку (AC-CARD-12); решта — угорі форми (відмова ролі, дублікат дитини, збій збереження).
const ERROR_FIELD: Partial<Record<CardErrorCode, FieldName>> = {
  TYPE_INVALID: "type",
  CLIENT_INVALID: "name",
  CHILD_NAME: "name",
  BIRTH_DATE: "dateOfBirth",
  LANGUAGE: "language",
  GUARDIAN_INVALID: "guardianName",
  CLIENT_DUPLICATE: "email",
};
// Поля, які ще підсвічує помилка, показана біля іншого поля (ім'я та email дорослого, ім'я та email опікуна).
const ALSO_INVALID: Partial<Record<CardErrorCode, FieldName[]>> = {
  CLIENT_INVALID: ["email"],
  GUARDIAN_INVALID: ["guardianEmail"],
};

const INITIAL: CardFormState = { errors: [], values: EMPTY_CARD_FORM };

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-small text-destructive" data-testid="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Форма картки: значення керовані станом, тож якщо картку не створено, усе введене лишається у формі (AC-CARD-03,
// AC-CARD-12, AC-CARD-13). Дорослий — email; дитина — ім'я та email опікуна (AC-CARD-01, AC-CARD-02).
export function ClientCardForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(createClientCard, INITIAL);
  const [values, setValues] = useState<CardForm>(EMPTY_CARD_FORM);

  const fieldError = (field: FieldName) => {
    const code = state.errors.find((candidate) => ERROR_FIELD[candidate] === field);
    return code ? CARD_MESSAGES[code] : undefined;
  };
  const invalid = (field: FieldName) =>
    state.errors.some((code) => ERROR_FIELD[code] === field || ALSO_INVALID[code]?.includes(field));
  const describedBy = (field: FieldName) => {
    const own = state.errors.find((code) => ERROR_FIELD[code] === field);
    const other = state.errors.find((code) => ALSO_INVALID[code]?.includes(field));
    if (own) return `card-${field}-error`;
    if (other) return `card-${ERROR_FIELD[other]}-error`;
    return undefined;
  };
  const fieldProps = (field: FieldName) => ({
    id: `card-${field}`,
    value: values[field],
    "aria-invalid": invalid(field) || undefined,
    "aria-describedby": describedBy(field),
  });
  const set = (field: FieldName) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));
  const formErrors = state.errors.filter((code) => !ERROR_FIELD[code]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {formErrors.length > 0 ? (
            <Alert variant="destructive">
              <CircleAlertIcon strokeWidth={1.5} aria-hidden="true" />
              {formErrors.map((code) => (
                <AlertTitle key={code}>{CARD_MESSAGES[code]}</AlertTitle>
              ))}
            </Alert>
          ) : null}

          <Field id="card-type" label="Client type" error={fieldError("type")}>
            <NativeSelect name="type" onChange={set("type")} {...fieldProps("type")}>
              <NativeSelectOption value="">Select…</NativeSelectOption>
              <NativeSelectOption value="adult">Adult</NativeSelectOption>
              <NativeSelectOption value="child">Child</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="card-name" label="Name" error={fieldError("name")}>
            <Input name="name" autoComplete="off" onChange={set("name")} {...fieldProps("name")} />
          </Field>
          <Field id="card-dateOfBirth" label="Date of birth" error={fieldError("dateOfBirth")}>
            <Input
              name="date_of_birth"
              type="date"
              max={today}
              className="w-48"
              onChange={set("dateOfBirth")}
              {...fieldProps("dateOfBirth")}
            />
          </Field>
          <Field id="card-language" label="Session language" error={fieldError("language")}>
            <NativeSelect name="session_language" onChange={set("language")} {...fieldProps("language")}>
              <NativeSelectOption value="">Select…</NativeSelectOption>
              {SESSION_LANGUAGES.map((language) => (
                <NativeSelectOption key={language} value={language}>
                  {language}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {values.type === "adult" ? (
            <Field id="card-email" label="Email" error={fieldError("email")}>
              <Input name="email" type="email" autoComplete="off" onChange={set("email")} {...fieldProps("email")} />
            </Field>
          ) : null}
          {values.type === "child" ? (
            <>
              <Field id="card-guardianName" label="Guardian name" error={fieldError("guardianName")}>
                <Input
                  name="guardian_name"
                  autoComplete="off"
                  onChange={set("guardianName")}
                  {...fieldProps("guardianName")}
                />
              </Field>
              <Field id="card-guardianEmail" label="Guardian email">
                <Input
                  name="guardian_email"
                  type="email"
                  autoComplete="off"
                  onChange={set("guardianEmail")}
                  {...fieldProps("guardianEmail")}
                />
              </Field>
            </>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              Create client card
            </Button>
            <Link href="/clients" className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
