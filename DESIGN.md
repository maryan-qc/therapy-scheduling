# Дизайн-система: Therapy scheduling

- **Джерело:** артефакт Claude Design типу Design System — https://claude.ai/artifact/4gmsBqWR4ZaqwwJKjLsXSd
  (приватний; знімок — в описі PR дизайн-системи). Правила й токени перенесено агентом Claude Code у цей файл і
  `src/app/globals.css`; промпт для артефакту — в описі того самого PR.
- **Вхід від PM:** розділу «Вигляд і тон» у `requirements/product.md` на момент PR немає (знімок 2026-10-21), тому
  джерело — бачення продукту й ролі з `requirements/product.md` і бриф команди.
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui); перевірка — `npm run check:design`.

## 1. Огляд

Внутрішній застосунок приватної практики психотерапії для адміністратора, планувальника й терапевта. Планувальник
утримує слоти терапевтів за клієнтами на 24 години й підтверджує утримання, терапевт бачить свій розклад на тиждень.
Працюють за ноутбуком чи монітором, щодня й багато разів на день, з чутливими даними клієнтів.

- **Тон:** спокійний, стриманий, надійний, точний. Уникаємо «медичної» стерильності, рекламних кольорів, ігрових
  елементів, ілюстрацій і емодзі.
- **Колір отримують лише** основна дія (`primary`), помилки (`destructive`) і статуси (`status-*`). Решта — тихі
  нейтральні тла: теплий «папір» у світлій темі, тепле майже чорне тло в темній.
- **Щільність середня:** таблиця дня (8 слотів) видно без прокрутки на ноутбуці 1366×768.
- **Мова інтерфейсу — англійська**, sentence case: «Hold», «Sign out», «My schedule».

## 2. Кольори

Семантичні токени з іменами shadcn/ui. Значення — OKLCH. У сторінках — лише утиліти з колонки «Клас», ніколи hex,
`bg-[#…]` чи сирі палітри (`zinc-500`, `bg-white`). Темна тема — за системою (`prefers-color-scheme`), перемикача в
інтерфейсі немає.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й шапки, основний текст | `oklch(0.985 0.002 85)` / `oklch(0.22 0.008 75)` | `oklch(0.17 0.004 75)` / `oklch(0.955 0.004 85)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | таблиці, картки, Alert | `oklch(1 0 0)` / `oklch(0.22 0.008 75)` | `oklch(0.205 0.005 75)` / `oklch(0.955 0.004 85)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | Dialog, випадні списки | `oklch(1 0 0)` / `oklch(0.22 0.008 75)` | `oklch(0.225 0.005 75)` / `oklch(0.955 0.004 85)` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | основна дія — одна на екран | `oklch(0.32 0.045 262)` / `oklch(0.985 0.004 262)` | `oklch(0.9 0.02 262)` / `oklch(0.215 0.03 262)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія, активний пункт навігації | `oklch(0.95 0.004 85)` / `oklch(0.22 0.008 75)` | `oklch(0.265 0.005 75)` / `oklch(0.955 0.004 85)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | рядок заголовків таблиці, вимкнені поля / підписи, метадані, пояс, рядки Past | `oklch(0.96 0.004 85)` / `oklch(0.5 0.01 75)` | `oklch(0.245 0.005 75)` / `oklch(0.74 0.008 80)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | нейтральне наведення (ghost, outline, рядок таблиці) | `oklch(0.945 0.005 85)` / `oklch(0.22 0.008 75)` | `oklch(0.275 0.006 75)` / `oklch(0.955 0.004 85)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | незворотна дія; текст, іконка й межа помилки | `oklch(0.52 0.17 27)` / `oklch(0.985 0.004 27)` | `oklch(0.72 0.14 25)` / `oklch(0.2 0.03 25)` | `bg-destructive`, `text-destructive` |
| `border` | декоративні лінії: межі карток і таблиць, розділювачі | `oklch(0.91 0.006 80)` | `oklch(0.3 0.006 75)` | `border-border` |
| `input` | межа поля, Select, outline-кнопки (≥ 3:1) | `oklch(0.62 0.01 75)` | `oklch(0.54 0.008 75)` | `border-input` |
| `ring` | кільце фокусу клавіатури | `oklch(0.52 0.12 258)` | `oklch(0.74 0.11 258)` | `ring-ring`, `outline-ring` |
| `overlay` | затемнення під Dialog | `oklch(0.22 0.008 75 / 0.4)` | `oklch(0 0 0 / 0.6)` | `bg-overlay` |
| `status-free` / `-foreground` | Free — слот вільний | `oklch(0.955 0.035 155)` / `oklch(0.42 0.09 155)` | `oklch(0.285 0.045 155)` / `oklch(0.87 0.09 155)` | `bg-status-free`, `text-status-free-foreground` |
| `status-held` / `-foreground` | Held — утримано, чекає підтвердження до 24 год | `oklch(0.955 0.045 85)` / `oklch(0.45 0.09 65)` | `oklch(0.3 0.045 75)` / `oklch(0.88 0.09 80)` | `bg-status-held`, `text-status-held-foreground` |
| `status-confirmed` / `-foreground` | Confirmed — утримання підтверджено | `oklch(0.952 0.02 255)` / `oklch(0.44 0.12 258)` | `oklch(0.29 0.05 258)` / `oklch(0.87 0.06 255)` | `bg-status-confirmed`, `text-status-confirmed-foreground` |
| `status-past` / `-foreground` | Past — слот уже почався чи минув | `oklch(0.945 0.003 85)` / `oklch(0.47 0.008 75)` | `oklch(0.255 0.004 75)` / `oklch(0.76 0.006 80)` | `bg-status-past`, `text-status-past-foreground` |
| `status-expired` / `-foreground` | Expired — утримання прострочене | `oklch(0.952 0.022 20)` / `oklch(0.48 0.15 25)` | `oklch(0.29 0.05 20)` / `oklch(0.86 0.07 20)` | `bg-status-expired`, `text-status-expired-foreground` |

### Статуси

| Статус | Маркер | Означає |
|---|---|---|
| Free | ○ порожнє коло | слот вільний, його можна утримати |
| Held | ◐ напівзаповнене коло | утримано за клієнтом, чекає підтвердження до 24 год |
| Confirmed | ● заповнене коло | утримання підтверджено |
| Past | – риска | слот уже почався або минув; дій немає |
| Expired | ⊘ перекреслене коло | утримання прострочене |

Статус ніколи не передається лише кольором: `Badge` завжди друкує слово, маркер повторює його формою, рядок Past ще
й приглушує текст. Слова статусів сталі — не заміняємо їх синонімами («Booked», «Pending», «Reserved»).

### Контраст

Пораховано за WCAG 2.x з OKLCH-значень (OKLab → лінійний sRGB → відносна яскравість) для обох тем; ті самі числа
дає таблиця артефакту. Поріг: текст і маркери статусів ≥ 4.5:1, межі полів і кільце фокусу ≥ 3:1. Жодна пара не
нижче порога.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.59 | 16.77 | ≥ 4.5 |
| `foreground` на `muted` | 15.42 | 14.24 | ≥ 4.5 |
| `card-foreground` на `card` | 17.32 | 15.72 | ≥ 4.5 |
| `popover-foreground` на `popover` | 17.32 | 15.01 | ≥ 4.5 |
| `primary-foreground` на `primary` | 12.18 | 13.01 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 14.97 | 13.43 | ≥ 4.5 |
| `accent-foreground` на `accent` | 14.75 | 13.01 | ≥ 4.5 |
| `muted-foreground` на `background` | 5.75 | 8.29 | ≥ 4.5 |
| `muted-foreground` на `card` | 6.01 | 7.77 | ≥ 4.5 |
| `muted-foreground` на `muted` | 5.35 | 7.04 | ≥ 4.5 |
| `muted-foreground` на `popover` | 6.01 | 7.42 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 5.75 | 6.92 | ≥ 4.5 |
| `destructive` на `card` | 6.01 | 6.80 | ≥ 4.5 |
| `destructive` на `background` | 5.75 | 7.26 | ≥ 4.5 |
| `status-free-foreground` на `status-free` | 7.19 | 9.84 | ≥ 4.5 |
| `status-held-foreground` на `status-held` | 6.68 | 9.50 | ≥ 4.5 |
| `status-confirmed-foreground` на `status-confirmed` | 6.83 | 9.56 | ≥ 4.5 |
| `status-past-foreground` на `status-past` | 5.82 | 7.34 | ≥ 4.5 |
| `status-expired-foreground` на `status-expired` | 6.10 | 9.16 | ≥ 4.5 |
| `input` на `background` | 3.49 | 3.78 | ≥ 3 |
| `input` на `card` | 3.64 | 3.54 | ≥ 3 |
| `input` на `popover` | 3.64 | 3.38 | ≥ 3 |
| `ring` на `background` | 5.32 | 8.28 | ≥ 3 |
| `ring` на `card` | 5.55 | 7.76 | ≥ 3 |
| `ring` на `popover` | 5.55 | 7.41 | ≥ 3 |
| `ring` на `muted` | 4.94 | 7.03 | ≥ 3 |

Свідомо нижче 3:1: `border` до `card` (1.31) — лише декоративні лінії, контроли мають `input`; тла статусів до `card`
(1.13–1.31) — тінт лише підкріплює, значення несуть слово й маркер (≥ 4.5:1 до тінту).

## 3. Типографіка

Одна гарнітура — Geist через `next/font` (`--font-sans`). Ваги: 400 і 500 для тексту, 600 лише для заголовків. Не
менше 12px; без курсиву й ВЕЛИКИХ ЛІТЕР для виділення.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-xl font-semibold tracking-tight` | один на сторінку (20/28) |
| Заголовок розділу, картки, Dialog | `text-base font-semibold` | 16/24 |
| Основний текст, клітинки | `text-sm` | 14/20 |
| Підпис поля, кнопка, навігація | `text-sm font-medium` | 14/20, 500 |
| Час, дати, числа | `text-sm tabular-nums` | завжди з табличними цифрами |
| Опис, підпис поясу, заголовки стовпців | `text-small text-muted-foreground` | 13/18 |
| Бейдж статусу чи ролі | `text-xs font-medium` | 12/16 |

## 4. Відступи й радіуси

- Шкала з базою 4px (Tailwind): `gap-1` 4 · `gap-2` 8 · `gap-3` 12 · `gap-4` 16 · `gap-6` 24 · `gap-8` 32 · `py-12` 48.
  Між полями форми — `gap-4`, між секціями — `gap-6`/`gap-8`, поля сторінки — `px-6`.
- Висоти: кнопки й поля `h-9` (36px), дії в рядках і Sign out `h-8` (32px), заголовок таблиці `h-10`, рядок `h-11`,
  шапка `h-14`. Ширина вмісту — до `max-w-content` (1200px).
- Радіуси (`--radius: 0.5rem`): `rounded-sm` (4) — бейджі; `rounded-md` (6) — кнопки, поля, Select, навігація;
  `rounded-lg` (8) — картки, таблиці, Alert; `rounded-xl` (12) — Dialog.
- Межі 1px: `border-border` — декоративні, `border-input` — контроли, `border-destructive` — невалідне поле й Alert
  помилки. Тіні: `shadow-sm` — картки й таблиці, `shadow-lg` — Dialog і випадні списки; інших немає.

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові — `npx shadcn@4.22.1 add <назва>`.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; розміри `default` (36), `sm` (32) | `default` — одна основна дія на екран; дії в рядках таблиці — `outline` або `ghost` `sm`, ніколи не `default`; `destructive` — лише незворотна дія з підтвердженням |
| `Input` + `Label` | — | у кожного поля видимий `Label` з `htmlFor`; плейсхолдер — лише приклад формату |
| `Select` | — | фільтр без видимого підпису має `aria-label` |
| `Card` | `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | одна сутність; карток у картки не вкладаємо |
| `Table` | `TableHeader`, `TableRow`, `TableHead`, `TableCell` | рядок заголовків на `muted`; час — `tabular-nums`; статус — `Badge`; порожня клітинка — «—» у `text-muted-foreground` |
| `Badge` | статуси `free`, `held`, `confirmed`, `past`, `expired`; `outline` — роль | слово й маркер завжди; `outline` — лише для ролі в шапці |
| `Alert` | `default` (успіх), `destructive` (помилка) | успіх — `role="status"`, помилка — `role="alert"`; текст дослівно з AC |
| `Dialog` | — | одна задача; Esc і клік по затемненню закривають; фокус повертається на кнопку, що відкрила |

## 6. Стани

Тексти — дослівно з AC PM (`src/lib/holds/messages.ts`, `src/lib/holds/clients.ts`, `src/lib/holds/day-view.ts`).

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | речення в `text-muted-foreground` над таблицею чи замість неї | «No free slots on this day.», «No holds.», «No slots.» |
| Помилка дії | `Alert` `destructive` угорі екрана, `role="alert"` | «This slot is no longer available.», «A client with this email already exists.» |
| Помилка введення | `Alert` `destructive`; поле з `aria-invalid` і межею `destructive` | «Enter the client's name and a valid email.», «Select a client to hold the slot.» |
| Відмова в доступі | `Alert` `destructive` з текстом відмови, без запису даних | «Only schedulers and admins can hold slots.» |
| Успіх | `Alert` `default` угорі екрана, `role="status"` | «Slot held.», «Hold confirmed.», «Client created.» |
| Очікування | кнопка лишає ширину, стає `disabled` | — |
| Вимкнена дія | `disabled` (прозорість 0.5, `cursor-not-allowed`) | — |

## 7. Доступність — мінімум

- Label у кожного поля; помилка поля пов'язана з полем (`aria-describedby`).
- Видимий фокус лише на `:focus-visible`: кільце `ring` 2px з відступом 2px на кожному інтерактивному елементі; Tab
  проходить форму по порядку. Outline без заміни не прибираємо.
- Контраст — таблиця в розділі 2.
- Статус ніколи не лише кольором — поруч завжди слово й маркер.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує.
- Час завжди в поясі практики America/Los_Angeles, і на кожному екрані з часом пояс підписано.
- Анімації — лише короткі (до 150 мс) переходи кольору; без анімацій появи, шимерів і конфеті.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `Badge` зі словом статусу й маркером | статус лише кольором фону чи крапкою |
| одна основна (`default`) кнопка на екран | кілька заливних кнопок у рядках таблиці |
| повідомлення — одне коротке речення з крапкою | знаки оклику, емодзі, «Oops» |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| `tabular-nums` для часу й дат | час у поясі браузера чи без підпису поясу |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза
  `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/ws7-*`), Tab по формі, контраст.

## 11. Що з артефакту не беремо (і чому)

Артефакт пропонує кілька правил поведінки, яких немає у вимогах PM. Без питання до PM у застосунок їх не переносимо:

- **12-годинний час** («9:00–9:50 AM») і довгі дати — у зрізі 1 час 24-годинний (`HH:MM`), дата `YYYY-MM-DD`,
  слоти по 60 хвилин; зміну формату робимо лише за рішенням PM.
- **Дії «Release hold» і «Hold again»**, утримання через Dialog — таких дій у зрізі немає; утримання — форма в рядку
  таблиці.
- **Ім'я клієнта з ініціалом у списках** — змінило б те, що показують AC зрізу 1 (ім'я та email).
- **Мова сторінки входу.** Сторінка входу з шаблону — українською («Вхід», «Пароль», «Увійти»), решта інтерфейсу —
  англійською. TODO: питання PM — якою мовою має бути вхід.
