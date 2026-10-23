"use client";

import { CircleAlertIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
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

// Яке поле підсвічує кожна помилка (aria-invalid + aria-describedby на текст помилки).
const ERROR_FIELDS: Record<CardErrorCode, FieldName[]> = {
  CARD_FORBIDDEN: [],
  TYPE_INVALID: ["type"],
  CLIENT_INVALID: ["name", "email"],
  CHILD_NAME: ["name"],
  BIRTH_DATE: ["dateOfBirth"],
  LANGUAGE: ["language"],
  GUARDIAN_INVALID: ["guardianName", "guardianEmail"],
  CLIENT_DUPLICATE: ["email"],
  CARD_DATA_INVALID: [],
  SAVE_FAILED: [],
};

const INITIAL: CardFormState = { errors: [], values: EMPTY_CARD_FORM };

// Форма картки: значення керовані станом, тож якщо картку не створено, усе введене лишається у формі (AC-CARD-03).
// Дорослий — email; дитина — ім'я та email опікуна (AC-CARD-01, AC-CARD-02).
export function ClientCardForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(createClientCard, INITIAL);
  const [values, setValues] = useState<CardForm>(EMPTY_CARD_FORM);
  const child = values.type === "child";

  const invalid = (field: FieldName) => state.errors.some((code) => ERROR_FIELDS[code].includes(field));
  const describedBy = (field: FieldName) =>
    state.errors
      .filter((code) => ERROR_FIELDS[code].includes(field))
      .map((code) => `card-error-${code}`)
      .join(" ") || undefined;
  const fieldProps = (field: FieldName) => ({
    value: values[field],
    "aria-invalid": invalid(field) || undefined,
    "aria-describedby": describedBy(field),
  });
  const set = (field: FieldName) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {state.errors.length > 0 ? (
            <Alert variant="destructive">
              <CircleAlertIcon strokeWidth={1.5} aria-hidden="true" />
              {state.errors.map((code) => (
                <AlertTitle key={code} id={`card-error-${code}`}>
                  {CARD_MESSAGES[code]}
                </AlertTitle>
              ))}
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-type">Client type</Label>
            <NativeSelect id="card-type" name="type" onChange={set("type")} {...fieldProps("type")}>
              <NativeSelectOption value="adult">Adult</NativeSelectOption>
              <NativeSelectOption value="child">Child</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-name">Name</Label>
            <Input id="card-name" name="name" autoComplete="off" onChange={set("name")} {...fieldProps("name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-dob">Date of birth</Label>
            <Input
              id="card-dob"
              name="date_of_birth"
              type="date"
              max={today}
              className="w-48"
              onChange={set("dateOfBirth")}
              {...fieldProps("dateOfBirth")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-language">Session language</Label>
            <NativeSelect
              id="card-language"
              name="session_language"
              onChange={set("language")}
              {...fieldProps("language")}
            >
              <NativeSelectOption value="">Select…</NativeSelectOption>
              {SESSION_LANGUAGES.map((language) => (
                <NativeSelectOption key={language} value={language}>
                  {language}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {child ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-guardian-name">Guardian name</Label>
                <Input
                  id="card-guardian-name"
                  name="guardian_name"
                  autoComplete="off"
                  onChange={set("guardianName")}
                  {...fieldProps("guardianName")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-guardian-email">Guardian email</Label>
                <Input
                  id="card-guardian-email"
                  name="guardian_email"
                  type="email"
                  autoComplete="off"
                  onChange={set("guardianEmail")}
                  {...fieldProps("guardianEmail")}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-email">Email</Label>
              <Input
                id="card-email"
                name="email"
                type="email"
                autoComplete="off"
                onChange={set("email")}
                {...fieldProps("email")}
              />
            </div>
          )}

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
