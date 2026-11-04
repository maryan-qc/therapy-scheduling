"use client";

import { Loader2Icon } from "lucide-react";
import type * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Кнопка відправки форми з Server Action (DESIGN.md, розділ 6 «Очікування»): поки дія виконується — disabled,
 * aria-busy і спінер перед підписом. Підпис не змінюється: за ним кнопку знаходять люди й тести. Повторне натискання
 * під час запиту неможливе, тож дія не виконується двічі. Іконка дії (`icon`) на час запиту поступається спінеру.
 */
export function SubmitButton({
  children,
  disabled,
  icon,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" data-icon="inline-start" /> : icon}
      {children}
    </Button>
  );
}
