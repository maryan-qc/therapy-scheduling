"use client";

import { useRef } from "react";
import type * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";

// Вибір терапевта мишею одразу показує його слоти: форма фільтра відправляється сама. З клавіатури — ні: стрілки
// змінюють значення закритого списку на кожному кроці, і сторінка перезавантажувалась би під пальцями (WCAG 3.2.2);
// там, як і для пошуку клієнта, дати й роботи без JavaScript, лишається кнопка Show.
export function TherapistSelect(props: React.ComponentProps<typeof NativeSelect>) {
  const fromKeyboard = useRef(false);
  return (
    <NativeSelect
      {...props}
      onKeyDown={() => {
        fromKeyboard.current = true;
      }}
      onPointerDown={() => {
        fromKeyboard.current = false;
      }}
      onChange={(event) => {
        if (!fromKeyboard.current) event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
