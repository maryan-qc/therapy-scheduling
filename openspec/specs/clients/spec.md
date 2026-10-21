# clients Specification

## Purpose
Картка клієнта з ім'ям та email, яку планувальник або адміністратор створює, коли клієнт звертається до практики,
і вибирає під час утримання слоту терапевта.

## Requirements

### Requirement: Створення картки клієнта

WHEN планувальник або адміністратор створює клієнта з ім'ям та email, якого ще немає серед клієнтів, the system SHALL створити картку клієнта, яку можна вибрати під час утримання слоту, і зберігати й показувати email малими літерами без пробілів на початку й у кінці.

#### Scenario: AC-HOLD-10 Створення картки клієнта

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта з іменем «Client Three» і email client3@example.test
- **THEN** картку клієнта створено
- **AND** його можна вибрати під час утримання слоту

#### Scenario: AC-HOLD-35 Email зберігається малими літерами без пробілів по краях

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта «Client Three» з email « Client3@Example.TEST »
- **THEN** клієнта створено
- **AND** у картці клієнта та під час утримання його email показано як client3@example.test

### Requirement: Ім'я та коректний email

IF під час створення клієнта ім'я порожнє або email некоректний, THEN the system SHALL не створювати клієнта й показати повідомлення «Enter the client's name and a valid email.»

#### Scenario: AC-HOLD-11 Порожнє ім'я клієнта

- **GIVEN** планувальник створює клієнта
- **WHEN** ім'я залишено порожнім, а email — client3@example.test
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «Enter the client's name and a valid email.»

#### Scenario: AC-HOLD-15 Email без знака @

- **GIVEN** планувальник створює клієнта
- **WHEN** ім'я — «Client Three», а email — «client3example.test» (без знака @)
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «Enter the client's name and a valid email.»

### Requirement: Унікальний email клієнта

IF клієнт з таким email уже існує — без урахування великих і малих літер та пробілів на початку й у кінці, THEN the system SHALL не створювати ще одного клієнта й показати повідомлення «A client with this email already exists.»

#### Scenario: AC-HOLD-16 Дублікат email клієнта

- **GIVEN** клієнт з email client1@example.test уже існує
- **WHEN** планувальник створює ще одного клієнта з email client1@example.test
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «A client with this email already exists.»

#### Scenario: AC-HOLD-34 Дублікат email з іншим регістром і пробілами

- **GIVEN** клієнт з email client1@example.test уже існує
- **WHEN** планувальник створює клієнта «Client One» з email « Client1@Example.TEST » (з великими літерами й пробілами на початку та в кінці)
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «A client with this email already exists.»
