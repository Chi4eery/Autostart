# АвтоСтарт

«АвтоСтарт» — локальное дипломное веб-приложение условной коммерческой автошколы. Система предназначена для регистрации пользователей, подачи заявок на обучение, управления курсами, расписанием, записями на занятия, учебными материалами, уведомлениями и административными процессами автошколы.

Онлайн-оплата в проекте не реализована. Оформление договора и оплата выполняются вне системы администратором. Email/VK-рассылка также не подключена: основной рабочий канал уведомлений — внутренний канал `site`.

## Стек технологий

- Frontend: HTML5, CSS3, JavaScript без React/Vue/Angular.
- Backend: Node.js, Express.
- Database: Microsoft SQL Server.
- Подключение к БД: `mssql`, `msnodesqlv8` для локальной Windows-аутентификации.
- Авторизация: JWT.
- Защита паролей: bcrypt.
- Конфигурация: `.env` через `dotenv`.

## Структура проекта

```text
autoschool-app/
  server.js
  package.json
  package-lock.json
  .env.example
  .gitignore
  README.md
  AUTOSTART_FULL_DOCUMENTATION.txt
  database/
    schema.sql
    seed.sql
    migrations/
  src/
    config/
    controllers/
    middleware/
    routes/
    services/
  public/
    css/
    js/
    index.html
    login.html
    enrollment.html
    applicant.html
    dashboard.html
    instructor.html
    admin.html
    materials.html
    notifications.html
```

## Роли пользователей

- `Guest` — просмотр публичной части сайта.
- `Applicant` — зарегистрированный пользователь, который может отправить заявку на обучение и ждать обработки.
- `Student` — зачисленный обучающийся с доступом к учебному кабинету, расписанию своих записей, теории, вождению, экзаменам, прогрессу, материалам и уведомлениям.
- `Instructor` — инструктор, который видит свои занятия, добавляет слоты теории/вождения и отмечает результат занятия.
- `Admin` — администратор, который управляет пользователями, ролями, инструкторами, курсами, занятиями, заявками, материалами, уведомлениями и результатами.

## Локальная установка

Установите зависимости:

```bash
npm install
```

## Настройка базы данных

База данных проекта называется:

```text
AutoSchoolDB
```

Порядок настройки через SQL Server Management Studio:

1. Подключиться к локальному SQL Server.
2. Открыть и выполнить `database/schema.sql`.
3. Открыть и выполнить `database/seed.sql`.

`schema.sql` создает базу данных, таблицы, связи и индексы.  
`seed.sql` добавляет демонстрационные роли, пользователей, инструкторов, курсы, занятия, темы теории, материалы, заявки и уведомления.

## Настройка переменных окружения

Создайте файл `.env` в корне проекта на основе `.env.example`.

Безопасный шаблон:

```env
PORT=3000
NODE_ENV=development

DB_TRUSTED_CONNECTION=false
DB_USER=
DB_PASSWORD=
DB_SERVER=localhost
DB_DATABASE=AutoSchoolDB
DB_PORT=1433
DB_ODBC_DRIVER=ODBC Driver 17 for SQL Server
DB_ENCRYPT=false

JWT_SECRET=change_me
```

Для локальной Windows-аутентификации можно использовать:

```env
DB_TRUSTED_CONNECTION=true
DB_USER=
DB_PASSWORD=
```

Для SQL Server Login используйте:

```env
DB_TRUSTED_CONNECTION=false
DB_USER=your_sql_login
DB_PASSWORD=
```

Для облачной SQL-базы обычно требуется:

```env
DB_ENCRYPT=true
```

Файл `.env` содержит локальные настройки и не должен попадать в GitHub.

## Запуск

```bash
npm start
```

Если PowerShell блокирует `npm.ps1`, можно запустить:

```powershell
npm.cmd start
```

После запуска сайт доступен по адресу:

```text
http://localhost:3000
```

Проверка состояния API и подключения к БД:

```text
http://localhost:3000/api/health
```

## Тестовые аккаунты

Демонстрационные аккаунты предназначены только для локальной проверки проекта.  
Пароль для всех тестовых аккаунтов:

```text
password
```

В базе данных хранится bcrypt-хэш, а не открытый пароль.

| Роль | Email |
| --- | --- |
| Admin | admin@autostart.local |
| Applicant | applicant@autostart.local |
| Student | student1@autostart.local |
| Student | student2@autostart.local |
| Instructor | instructor1@autostart.local |
| Instructor | instructor2@autostart.local |

## Основные API

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`

Users:

- `GET /api/users/me`
- `GET /api/users/staff-contacts`
- `GET /api/users/roles`
- `GET /api/users`
- `PUT /api/users/:id`

Instructors:

- `GET /api/instructors`
- `GET /api/instructors/my-lessons`
- `POST /api/instructors/my-lessons`
- `POST /api/instructors`
- `PUT /api/instructors/:id`
- `DELETE /api/instructors/:id`

Courses:

- `GET /api/courses`
- `POST /api/courses`
- `PUT /api/courses/:id`
- `DELETE /api/courses/:id`

Lessons:

- `GET /api/lessons`
- `POST /api/lessons`
- `PUT /api/lessons/:id`
- `DELETE /api/lessons/:id`

Bookings:

- `POST /api/bookings`
- `GET /api/bookings/my`
- `GET /api/bookings`
- `PUT /api/bookings/:id/cancel`

Enrollment requests:

- `POST /api/enrollment-requests`
- `GET /api/enrollment-requests/my`
- `GET /api/enrollment-requests`
- `PUT /api/enrollment-requests/:id/status`
- `DELETE /api/enrollment-requests/:id`

Materials:

- `GET /api/materials`
- `POST /api/materials`
- `PUT /api/materials/:id`
- `DELETE /api/materials/:id`

Notifications:

- `GET /api/notifications/my`
- `PUT /api/notifications/:id/read`
- `POST /api/notifications`

Progress:

- `PUT /api/progress/bookings/:id`

Theory topics:

- `GET /api/theory-topics`

## Проверка мобильной версии

Откройте сайт в браузере, нажмите `F12`, включите режим устройства и проверьте ширины:

- 390px — мобильный экран;
- 768px — планшет;
- 1366px — desktop.

Проверьте главную страницу, страницу входа, кабинет заявителя, кабинет студента, кабинет инструктора и админ-панель.

## Подготовка к GitHub

В репозиторий должны попадать:

- исходный код `src/`;
- frontend `public/`;
- SQL-скрипты `database/`;
- `package.json`;
- `package-lock.json`;
- `.env.example`;
- `.gitignore`;
- `README.md`;
- документация проекта.

В репозиторий не должны попадать:

- `.env`;
- `node_modules/`;
- логи;
- временные файлы;
- локальные настройки IDE.
