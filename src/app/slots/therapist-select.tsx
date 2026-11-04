"use client";

import { useRef } from "react";
import type * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";

// Вибір терапевта мишею одразу показує його слоти: форма фільтра відправляється сама. Решта способів — ні: з клавіатури
// стрілки змінюють значення закритого списку на кожному кроці, і сторінка перезавантажувалась би під пальцями
// (WCAG 3.2.2); так само дотик і допоміжні технології. Там, як і для пошуку клієнта, дати й роботи без JavaScript,
// лишається кнопка Show.
export function TherapistSelect(props: React.ComponentProps<typeof NativeSelect>) {
  const fromMouse = useRef(false);
  return (
    <NativeSelect
      {...props}
      onKeyDown={() => {
        fromMouse.current = false;
      }}
      onPointerDown={(event) => {
        fromMouse.current = event.pointerType === "mouse";
      }}
      onChange={(event) => {
        if (fromMouse.current) event.currentTarget.form?.requestSubmit();
        fromMouse.current = false;
      }}
    />
  );
}
