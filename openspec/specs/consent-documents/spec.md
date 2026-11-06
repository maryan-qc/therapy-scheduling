# consent-documents Specification

## Purpose
Документи згоди клієнта: планувальник або адміністратор формує їх англійською в картці клієнта, бачить, яких підписів
бракує, і позначає документи підписаними; коли документи сформовано, утримання підтверджується лише з усіма
підписаними; терапевт бачить документи лише своїх клієнтів і не змінює їх.

## Requirements

### Requirement: Документів ще немає

WHEN для картки клієнта документів згоди ще не формували, the system SHALL показувати в картці повідомлення «No consent documents yet.» і жодного документа.

#### Scenario: AC-DOC-01 Документів ще не формували

- **GIVEN** картку client6 (тип «Adult») створено, і документів згоди для неї ще не формували
- **WHEN** scheduler1 відкриває картку client6
- **THEN** в картці показано повідомлення «No consent documents yet.» і жодного документа

### Requirement: Формування документів згоди

WHEN планувальник або адміністратор формує документи згоди для клієнта, якому їх ще не формували, the system SHALL створити рівно один набір — для типу «Adult» «Consent to treatment» і «Cancellation policy acknowledgement», для типу «Child» ще й «Release of information», у цьому порядку, — кожен зі станом «Not signed», і показати рядок «Missing signatures: …» з непідписаними документами через кому в порядку набору.

#### Scenario: AC-DOC-02 Документи дорослого клієнта

- **GIVEN** для client6 (тип «Adult») документів згоди ще немає
- **WHEN** scheduler1 формує документи згоди для client6
- **THEN** в картці client6 показано рівно два документи — «Consent to treatment» і «Cancellation policy acknowledgement», кожен зі станом «Not signed»
- **AND** показано рядок «Missing signatures: Consent to treatment, Cancellation policy acknowledgement»

#### Scenario: AC-DOC-03 Документи дитини з опікуном

- **GIVEN** для client7 (тип «Child», опікун «Guardian Seven») документів згоди ще немає
- **WHEN** scheduler1 формує документи згоди для client7
- **THEN** в картці client7 показано рівно три документи — «Consent to treatment», «Cancellation policy acknowledgement» і «Release of information», кожен зі станом «Not signed»

### Requirement: Текст документа згоди

WHEN користувач, якому доступна картка клієнта, відкриває документ згоди, the system SHALL показати документ англійською із заголовком документа, рядком «Client: <ім'я клієнта>», для дитини — рядком «Guardian: <ім'я опікуна>», рядком «Prepared: <дата формування РРРР-ММ-ДД>» і сталим текстом згоди.

#### Scenario: AC-DOC-04 Документ «Release of information» дитини

- **GIVEN** scheduler1 сформував документи згоди для client7 (тип «Child», ім'я «Client Seven», опікун «Guardian Seven») 2026-11-04
- **WHEN** scheduler1 відкриває документ «Release of information» client7
- **THEN** він бачить документ англійською із заголовком «Release of information», рядками «Client: Client Seven», «Guardian: Guardian Seven» і «Prepared: 2026-11-04»

### Requirement: Позначення документа підписаним

WHEN планувальник або адміністратор позначає документ згоди підписаним, the system SHALL показувати документ зі станом «Signed <РРРР-ММ-ДД ГГ:ХХ>» і рядок «Missing signatures: …» з рештою непідписаних документів, а коли непідписаних не лишилось — «All consent documents signed.» замість цього рядка.

#### Scenario: AC-DOC-05 Підписано перший документ

- **GIVEN** обидва документи згоди client6 мають стан «Not signed»
- **WHEN** scheduler1 2026-11-04 о 10:15 позначає «Consent to treatment» підписаним
- **THEN** «Consent to treatment» показано зі станом «Signed 2026-11-04 10:15»
- **AND** рядок у картці — «Missing signatures: Cancellation policy acknowledgement»

#### Scenario: AC-DOC-06 Підписано всі документи

- **GIVEN** «Consent to treatment» client6 має стан «Signed», а «Cancellation policy acknowledgement» — «Not signed»
- **WHEN** scheduler2 позначає «Cancellation policy acknowledgement» підписаним
- **THEN** обидва документи показано зі станом «Signed …»
- **AND** замість рядка «Missing signatures» картка показує «All consent documents signed.»

### Requirement: Підтвердження утримання лише з підписаними документами

IF утримання пройшло всі перевірки підтвердження зрізу 1 (роль, утримання знайдено й ще не підтверджене, не прострочене, слот ще не почався), для клієнта сформовано документи згоди і хоча б один має стан «Not signed», THEN the system SHALL не підтверджувати його утримання, показати повідомлення «Sign all consent documents before confirming.» і залишити утримання зі статусом «Held» і тим самим «Held until»; WHEN усі документи клієнта мають стан «Signed», the system SHALL підтверджувати утримання за правилами зрізу 1.

#### Scenario: AC-DOC-07 Не всі документи підписано

- **GIVEN** client6 має утримання зі статусом «Held» у therapist1, для client6 сформовано документи згоди, і документ «Cancellation policy acknowledgement» має стан «Not signed»
- **WHEN** scheduler1 пробує підтвердити це утримання
- **THEN** утримання не підтверджується, scheduler1 бачить повідомлення «Sign all consent documents before confirming.»
- **AND** утримання лишається зі статусом «Held» і тим самим «Held until»

#### Scenario: AC-DOC-08 Усі документи підписано

- **GIVEN** client6 має утримання зі статусом «Held» у therapist1, утримання ще не прострочене й слот ще не почався, а всі документи згоди client6 мають стан «Signed»
- **WHEN** scheduler1 підтверджує це утримання
- **THEN** слот має статус «Confirmed»
- **AND** «Held until» більше не показано

### Requirement: Документи згоди для терапевта

WHILE терапевт відкриває документ згоди свого клієнта, the system SHALL показувати документ і його стан без можливості позначити його підписаним — замість цього повідомлення «Only schedulers and admins can mark documents as signed.», а IF терапевт відкриває документ клієнта, який не є його клієнтом, THEN the system SHALL показати повідомлення «You don't have access to this client.» без тексту документа й даних клієнта; стан документа в обох випадках не змінюється; IF терапевт пробує сформувати документи згоди чи позначити документ підписаним, зокрема напряму, оминаючи сторінки застосунку, THEN the system SHALL відмовити й не створювати й не змінювати документів.

#### Scenario: AC-DOC-09 Терапевт бачить документ свого клієнта

- **GIVEN** client6 — свій клієнт therapist1, і документ «Consent to treatment» client6 має стан «Not signed»
- **WHEN** therapist1 відкриває цей документ за прямим посиланням
- **THEN** він бачить документ і стан «Not signed», позначити його підписаним йому не запропоновано — замість цього він бачить повідомлення «Only schedulers and admins can mark documents as signed.»
- **AND** scheduler1 після цього бачить у документа той самий стан «Not signed»

#### Scenario: AC-DOC-10 Терапевт відкриває документ чужого клієнта

- **GIVEN** client9 — свій клієнт лише для therapist2, і для client9 сформовано документи згоди
- **WHEN** therapist1 відкриває документ «Consent to treatment» client9 за прямим посиланням
- **THEN** therapist1 бачить повідомлення «You don't have access to this client.», жодного тексту документа чи даних client9 не показано
- **AND** стан документа не змінився

### Requirement: Документ згоди без входу

IF користувач, який не увійшов у застосунок, відкриває документ згоди за прямим посиланням, THEN the system SHALL показати лише сторінку входу без тексту документа й даних клієнта й не змінювати стан документа.

#### Scenario: AC-DOC-11 Без входу — лише сторінка входу

- **GIVEN** користувач не увійшов у застосунок, а для client6 сформовано документи згоди
- **WHEN** він відкриває документ «Consent to treatment» client6 за прямим посиланням
- **THEN** він бачить лише сторінку входу, тексту документа й даних client6 не показано
- **AND** стан документа не змінився
