(function () {
const {
  apiRequest,
  clearSession,
  escapeHtml,
  formatDateTime,
  getCurrentUser,
  lessonTypeLabel,
  requireAuth,
  setMessage,
  statusLabel
} = window.AutoSchool;

const currentStudent = requireAuth(['Student']);

const state = {
  profile: null,
  courses: [],
  theoryTopics: [],
  lessons: [],
  bookings: [],
  notifications: [],
  materials: [],
  staffContacts: [],
  currentSection: 'schedule',
  selectedTheoryTopicId: 1,
  notificationPopoverOpen: false
};

function qs(selector) {
  return document.querySelector(selector);
}

function fullName(user) {
  if (!user) return 'Обучающийся';
  return `${user.FirstName || user.firstName || ''} ${user.LastName || user.lastName || ''}`.trim() || 'Обучающийся';
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'С';
}

function instructorName(item) {
  if (!item.InstructorFirstName) return 'Инструктор будет назначен';
  return `${item.InstructorFirstName} ${item.InstructorLastName}`;
}

function lessonDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function uniqueBy(items, getKey, getLabel) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    const label = getLabel(item);
    if (key && label) map.set(String(key), label);
  });
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}

function isMarkedComplete(item) {
  return item && (item.ResultStatus === 'passed' || item.ResultStatus === 'failed');
}

function activeBookings() {
  return state.bookings.filter((booking) => booking.BookingStatus === 'active' && !isMarkedComplete(booking));
}

function bookedLesson(lessonId) {
  return activeBookings().find((booking) => Number(booking.LessonId) === Number(lessonId));
}

function completedLesson(lessonId) {
  return state.bookings.find((booking) => Number(booking.LessonId) === Number(lessonId) && isMarkedComplete(booking));
}

function passedBookings() {
  return state.bookings.filter((booking) => booking.ResultStatus === 'passed');
}

function passedLessonBookings(type) {
  return passedBookings().filter((booking) => booking.LessonType === type);
}

function passedTheoryTopicIds() {
  return new Set(
    passedLessonBookings('theory')
      .map((booking) => Number(booking.TheoryTopicId))
      .filter(Boolean)
  );
}

function bookingHours(booking) {
  const hours = Number(booking.HoursCompleted);
  return Number.isFinite(hours) && hours > 0 ? hours : 1;
}

function passedPracticeBookings() {
  return passedLessonBookings('practice');
}

function placesLeft(lesson) {
  return Number(lesson.MaxStudents || 0) - Number(lesson.ActiveBookings || 0);
}

function unreadNotifications() {
  return state.notifications.filter((notification) => !notification.IsRead);
}

function theoryPassedCount() {
  return Math.min(state.theoryTopics.length, passedTheoryTopicIds().size);
}

function theoryProgress() {
  if (!state.theoryTopics.length) return 0;
  return Math.round((theoryPassedCount() / state.theoryTopics.length) * 100);
}

function drivenHours() {
  return passedPracticeBookings().reduce((sum, booking) => sum + bookingHours(booking), 0);
}

function requiredDrivingHours() {
  const fromBookings = state.bookings
    .map((booking) => Number(booking.CourseRequiredDrivingHours))
    .find((hours) => Number.isFinite(hours) && hours > 0);
  if (fromBookings) return fromBookings;

  const fromLessons = state.lessons
    .map((lesson) => Number(lesson.CourseRequiredDrivingHours))
    .find((hours) => Number.isFinite(hours) && hours > 0);
  if (fromLessons) return fromLessons;

  const fromCourses = state.courses
    .map((course) => Number(course.RequiredDrivingHours))
    .find((hours) => Number.isFinite(hours) && hours > 0);

  return fromCourses || 52;
}

function practiceProgress() {
  return Math.min(100, Math.round((drivenHours() / requiredDrivingHours()) * 100));
}

function theoryExamUnlocked() {
  return state.theoryTopics.length > 0 && theoryPassedCount() === state.theoryTopics.length;
}

function practiceExamUnlocked() {
  return drivenHours() >= requiredDrivingHours();
}

function examProgress() {
  return (theoryExamUnlocked() ? 50 : 0) + (practiceExamUnlocked() ? 50 : 0);
}

function overallProgress() {
  return Math.round((theoryProgress() * 0.45) + (practiceProgress() * 0.45) + (examProgress() * 0.1));
}

function statusText(status) {
  const labels = {
    passed: 'Пройдено',
    available: 'Доступно',
    locked: 'Закрыто',
    failed: 'Не пройдено',
    active: 'Активно',
    cancelled: 'Отменено'
  };
  return labels[status] || statusLabel(status);
}

function progressBar(value) {
  return `
    <div class="student-progress-bar" aria-label="Прогресс ${escapeHtml(value)}%">
      <span style="width: ${Math.max(0, Math.min(100, Number(value)))}%"></span>
    </div>
  `;
}

function isTheoryLesson(lesson) {
  return lesson.LessonType === 'theory';
}

function isPracticeLesson(lesson) {
  return lesson.LessonType === 'practice';
}

function isExamLesson(lesson) {
  return lesson.LessonType === 'exam';
}

function includesAny(value, words) {
  const normalized = String(value || '').toLowerCase();
  return words.some((word) => normalized.includes(word));
}

function theoryScheduleLessons() {
  return state.lessons.filter((lesson) => isTheoryLesson(lesson) && !completedLesson(lesson.Id)).sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
}

function practiceLessons() {
  return state.lessons.filter((lesson) => isPracticeLesson(lesson) && !completedLesson(lesson.Id)).sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
}

function examLessons() {
  return state.lessons.filter((lesson) => isExamLesson(lesson) && !completedLesson(lesson.Id)).sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
}

function selectedTheoryTopic() {
  return state.theoryTopics.find((topic) => Number(topic.Id) === Number(state.selectedTheoryTopicId)) || state.theoryTopics[0];
}

function theoryTopicLessons(topic) {
  const lessons = theoryScheduleLessons();
  if (!topic) return lessons;
  return lessons.filter((lesson) => Number(lesson.TheoryTopicId) === Number(topic.Id));
}

function nextTheoryLessonForBooking() {
  return theoryScheduleLessons().find((lesson) => (
    bookedLesson(lesson.Id) || (lesson.Status === 'available' && placesLeft(lesson) > 0)
  )) || null;
}

function fillFilters() {
  const materialCourseSelect = qs('#material-filter-course');

  if (materialCourseSelect) {
    const courses = uniqueBy(state.materials, (material) => material.CourseId, (material) => material.CourseTitle);
    materialCourseSelect.innerHTML = '<option value="">Все материалы</option>' + courses.map((course) => (
      `<option value="${escapeHtml(course.value)}">${escapeHtml(course.label)}</option>`
    )).join('');
  }
}

function scheduleLessons() {
  return activeBookings().sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
}

function safeDateTime(value) {
  return value ? formatDateTime(value) : 'Дата не указана';
}

function lessonDisplayTitle(lesson) {
  const title = String(lesson.Title || '').trim();
  if (title) return title;
  if (lesson.LessonType === 'theory') return 'Теоретическое занятие';
  if (lesson.LessonType === 'practice') return 'Практическое занятие';
  if (lesson.LessonType === 'exam') return 'Экзамен';
  return 'Занятие';
}

function lessonMeta(lesson) {
  const freePlaces = Math.max(placesLeft(lesson), 0);
  return `
    <div class="lesson-meta-grid">
      <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(lesson.StartDateTime))}</strong></div>
      <div class="lesson-meta-item"><span>Окончание</span><strong>${escapeHtml(safeDateTime(lesson.EndDateTime))}</strong></div>
      <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(lesson))}</strong></div>
      <div class="lesson-meta-item"><span>Свободно мест</span><strong>${freePlaces} из ${escapeHtml(lesson.MaxStudents)}</strong></div>
    </div>
  `;
}

function scheduleLabel(lesson) {
  if (bookedLesson(lesson.Id)) return '<span class="status active">Вы записаны</span>';
  if (lesson.Status !== 'available') return `<span class="status ${escapeHtml(lesson.Status)}">${escapeHtml(statusLabel(lesson.Status))}</span>`;
  return '';
}

function renderReadonlyLessonCard(lesson) {
  return `
    <article class="student-lesson-card ${bookedLesson(lesson.Id) ? 'is-booked' : ''}">
      <div class="student-lesson-main">
        <div>
          <h3>${escapeHtml(lessonDisplayTitle(lesson))}</h3>
          <p>${escapeHtml(lesson.CourseTitle)} · ${escapeHtml(lessonTypeLabel(lesson.LessonType))}</p>
        </div>
        ${scheduleLabel(lesson)}
      </div>
      ${lessonMeta(lesson)}
    </article>
  `;
}

function renderBookedScheduleCard(booking) {
  return `
    <article class="student-lesson-card">
      <div class="student-lesson-main">
        <div>
          <h3>${escapeHtml(booking.LessonTitle || 'Занятие')}</h3>
          <p>${escapeHtml(booking.CourseTitle)} · ${escapeHtml(lessonTypeLabel(booking.LessonType))}</p>
        </div>
        <span class="status active">Вы записаны</span>
      </div>
      <div class="lesson-meta-grid">
        <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(booking.StartDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Окончание</span><strong>${escapeHtml(safeDateTime(booking.EndDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(booking))}</strong></div>
        <div class="lesson-meta-item"><span>Статус</span><strong>${escapeHtml(statusText(booking.BookingStatus))}</strong></div>
      </div>
    </article>
  `;
}

function renderBookingAction(lesson, lockedText = '') {
  if (!lesson) {
    return `<button disabled>Нет занятия в расписании</button>${lockedText ? `<small>${escapeHtml(lockedText)}</small>` : ''}`;
  }

  const booked = bookedLesson(lesson.Id);
  if (booked) {
    return `
      <span class="status active">Вы записаны</span>
      <button class="danger compact-button" data-cancel-booking="${booked.Id}">Отменить запись</button>
    `;
  }

  if (lockedText) return `<button disabled>Запись закрыта</button><small>${escapeHtml(lockedText)}</small>`;
  if (lesson.Status !== 'available') return `<button disabled>${escapeHtml(statusLabel(lesson.Status))}</button>`;
  if (placesLeft(lesson) <= 0) return '<button disabled>Мест нет</button>';
  return `<button data-book-lesson="${lesson.Id}">Записаться</button>`;
}

function renderBookableLessonCard(lesson, lockedText = '') {
  if (!lesson) {
    return `
      <article class="student-lesson-card muted-card">
        <h3>Занятие не назначено</h3>
        <p>Администратор еще не добавил подходящее занятие в расписание.</p>
        <div class="student-card-actions">${renderBookingAction(null, lockedText)}</div>
      </article>
    `;
  }

  const booked = bookedLesson(lesson.Id);
  return `
    <article class="student-lesson-card ${booked ? 'is-booked' : ''}">
      <div class="student-lesson-main">
        <div>
          <h3>${escapeHtml(lessonDisplayTitle(lesson))}</h3>
          <p>${escapeHtml(lesson.CourseTitle)} · ${escapeHtml(lessonTypeLabel(lesson.LessonType))}</p>
        </div>
        <span class="status ${booked ? 'active' : escapeHtml(lesson.Status)}">${booked ? 'Вы записаны' : escapeHtml(statusLabel(lesson.Status))}</span>
      </div>
      ${lessonMeta(lesson)}
      <div class="student-card-actions">${renderBookingAction(lesson, lockedText)}</div>
    </article>
  `;
}

function renderNotificationCompact(notification) {
  return `
    <article class="mini-record ${notification.IsRead ? '' : 'is-unread'}">
      <strong>${escapeHtml(notification.Title)}</strong>
      <span>${escapeHtml(notification.Message)}</span>
      <small>${formatDateTime(notification.CreatedAt)}</small>
    </article>
  `;
}

function renderNotificationPopover() {
  const popover = qs('#notification-popover');
  const list = qs('#notification-popover-list');
  const count = qs('#popover-notification-count');
  const unreadCount = unreadNotifications().length;

  if (popover) popover.hidden = !state.notificationPopoverOpen;
  if (count) count.textContent = `${unreadCount} новых`;

  if (list) {
    const visible = state.notifications.slice(0, 6);
    list.innerHTML = visible.length ? visible.map(renderNotificationCompact).join('') : '<div class="empty">Уведомлений пока нет.</div>';
  }
}

async function markVisibleNotificationsRead() {
  const unread = unreadNotifications();
  if (!unread.length) return;

  await Promise.all(unread.map((notification) => (
    apiRequest(`/notifications/${notification.Id}/read`, { method: 'PUT' })
  )));

  state.notifications = state.notifications.map((notification) => ({ ...notification, IsRead: true }));
  renderTopbar();
  renderNotificationPopover();
}

function renderTopbar() {
  const user = state.profile || getCurrentUser();
  const name = fullName(user);

  qs('#student-name').textContent = name;
  qs('#topbar-notification-count').textContent = String(unreadNotifications().length);
  renderNotificationPopover();
}

function groupLessonsByDate(lessons) {
  return lessons.reduce((map, lesson) => {
    const key = lessonDate(lesson.StartDateTime);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lesson);
    return map;
  }, new Map());
}

function dayTitle(key) {
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderAgenda(bookings) {
  const sortedBookings = [...bookings].sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
  const grouped = groupLessonsByDate(sortedBookings);
  const days = [...grouped.entries()];

  return `
    <div class="schedule-agenda">
      ${days.length ? days.map(([key, dayLessons]) => `
        <section class="agenda-day">
          <div class="agenda-day-head">
            <h4>${escapeHtml(dayTitle(key))}</h4>
          </div>
          <div class="agenda-list">
            ${dayLessons.map(renderBookedScheduleCard).join('')}
          </div>
        </section>
      `).join('') : '<div class="empty">Вы пока не записаны на занятия. Для записи откройте вкладки «Теория», «Вождение» или «Экзамены».</div>'}
    </div>
  `;
}

function renderLessons() {
  const container = qs('#lessons-list');
  if (!container) return;
  container.innerHTML = renderAgenda(scheduleLessons());
}

function renderProfile() {
  const container = qs('#profile-card');
  const profile = state.profile || getCurrentUser();
  if (!container || !profile) return;

  container.innerHTML = `
    <div class="profile-card-grid">
      <div class="profile-avatar">${escapeHtml(initials(fullName(profile)))}</div>
      <div>
        <h3>${escapeHtml(fullName(profile))}</h3>
        <p>Если данные изменились свяжитесь с администратором.</p>
      </div>
    </div>
    <div class="profile-fields">
      <div><span>Телефон</span><strong>${escapeHtml(profile.Phone || profile.phone || 'Не указан')}</strong></div>
      <div><span>Email</span><strong>${escapeHtml(profile.Email || profile.email || 'Не указан')}</strong></div>
      <div><span>Курс</span><strong>Категория B</strong></div>
      <div><span>Дата регистрации</span><strong>${profile.CreatedAt ? formatDateTime(profile.CreatedAt) : 'Не указана'}</strong></div>
    </div>
  `;
}

function renderTheory() {
  const stats = qs('#theory-stats');
  const container = qs('#theory-lessons');
  const currentTopic = selectedTheoryTopic();

  if (!currentTopic) {
    if (stats) stats.innerHTML = '';
    if (container) container.innerHTML = '<div class="empty">Темы теории пока не настроены в базе данных.</div>';
    return;
  }

  const topicLessons = theoryTopicLessons(currentTopic);
  const availableSlotsCount = topicLessons.filter((lesson) => (
    bookedLesson(lesson.Id) || (lesson.Status === 'available' && placesLeft(lesson) > 0)
  )).length;

  if (stats) {
    stats.innerHTML = `
      <div><strong>${theoryPassedCount()} из ${state.theoryTopics.length}</strong><span>тем пройдено</span></div>
      <div><strong>${theoryProgress()}%</strong><span>прогресс теории</span></div>
      <div><strong>${availableSlotsCount}</strong><span>слотов по выбранной теме</span></div>
    `;
  }

  if (!container) return;

  const passedTopicIds = passedTheoryTopicIds();
  const topicsHtml = state.theoryTopics.map((lesson, index) => {
    const isPassed = passedTopicIds.has(Number(lesson.Id));
    const slots = theoryTopicLessons(lesson);
    const isSelected = Number(lesson.Id) === Number(currentTopic.Id);

    return `
      <button type="button" class="theory-topic-card ${isSelected ? 'active' : ''} ${isPassed ? 'is-done' : ''}" data-theory-topic="${lesson.Id}">
        <div class="theory-main">
          <span class="lesson-number">${index + 1}</span>
          <div>
            <h3>${escapeHtml(lesson.Title)}</h3>
            <p>${slots.length ? `Доступно занятий: ${slots.length}` : 'Пока нет свободных занятий по этой теме.'}</p>
          </div>
        </div>
        <span class="status ${isPassed ? 'available' : slots.length ? 'new' : 'rejected'}">${escapeHtml(isPassed ? 'Пройдено' : slots.length ? 'Есть запись' : 'Нет слотов')}</span>
      </button>
    `;
  }).join('');

  const slotsHtml = topicLessons.length
    ? topicLessons.map((lesson) => renderBookableLessonCard(lesson)).join('')
    : `
      <article class="student-lesson-card muted-card">
        <h3>Занятий по теме пока нет</h3>
        <p>Преподаватели еще не добавили свободное время для этой темы. Проверьте расписание позже или свяжитесь с администратором.</p>
      </article>
    `;

  container.innerHTML = `
    <div class="theory-topic-layout">
      <div class="theory-topic-list">${topicsHtml}</div>
      <section class="theory-topic-detail">
        <div class="theory-detail-head">
          <div>
            <span class="status new">Выбранная тема</span>
            <h3>${escapeHtml(currentTopic.Title)}</h3>
            <p>Выберите удобное время у доступного преподавателя и запишитесь на занятие.</p>
          </div>
        </div>
        <div class="lesson-board compact-lessons">${slotsHtml}</div>
      </section>
    </div>
  `;
}

function renderDriving() {
  const progress = qs('#driving-progress');
  const lessonsList = qs('#driving-lessons-list');
  const requiredHours = requiredDrivingHours();
  const remaining = Math.max(requiredHours - drivenHours(), 0);

  if (progress) {
    progress.innerHTML = `
      <div class="driving-summary-card">
        <div>
          <span class="status new">Практика</span>
          <h3>Прогресс вождения: ${drivenHours()} из ${requiredHours} часов</h3>
          <p>До допуска к практическому экзамену осталось ${remaining} часов.</p>
        </div>
        ${progressBar(practiceProgress())}
        <div class="metric-grid compact">
          <div><strong>${drivenHours()}</strong><span>пройдено</span></div>
          <div><strong>${remaining}</strong><span>осталось</span></div>
          <div><strong>${practiceLessons().length}</strong><span>доступно в расписании</span></div>
        </div>
      </div>
    `;
  }

  if (lessonsList) {
    const lessons = practiceLessons();
    lessonsList.innerHTML = lessons.length
      ? lessons.map((lesson) => renderBookableLessonCard(lesson)).join('')
      : '<div class="empty">Практических занятий пока нет.</div>';
  }
}

function renderExams() {
  const container = qs('#exam-cards');
  const theoryExam = examLessons().find((lesson) => includesAny(lesson.Title, ['теор'])) || examLessons()[0];
  const practiceExam = examLessons().find((lesson) => includesAny(lesson.Title, ['практ', 'вожд'])) || examLessons()[1];
  const requiredHours = requiredDrivingHours();
  if (!container) return;

  container.innerHTML = `
    <article class="exam-card">
      <span class="status ${theoryExamUnlocked() ? 'available' : 'rejected'}">${theoryExamUnlocked() ? 'Доступен' : 'Закрыт'}</span>
      <h3>Теоретический экзамен</h3>
      <p>${theoryExamUnlocked() ? 'Все темы пройдены. Можно записаться на внутренний экзамен автошколы.' : 'Откроется после прохождения всех теоретических занятий.'}</p>
      <div class="student-card-actions">${renderBookingAction(theoryExam, theoryExamUnlocked() ? '' : 'Сначала нужно пройти все темы теории.')}</div>
    </article>
    <article class="exam-card">
      <span class="status ${practiceExamUnlocked() ? 'available' : 'rejected'}">${practiceExamUnlocked() ? 'Доступен' : 'Закрыт'}</span>
      <h3>Практический экзамен</h3>
      <p>${practiceExamUnlocked() ? `Набрано ${requiredHours} часов вождения. Можно согласовать дату внутреннего экзамена.` : `Откроется после выполнения ${requiredHours} часов вождения.`}</p>
      <div class="student-card-actions">${renderBookingAction(practiceExam, practiceExamUnlocked() ? '' : `Сначала нужно набрать ${requiredHours} часов вождения.`)}</div>
    </article>
    <article class="exam-card">
      <span class="status new">Информация</span>
      <h3>Экзамены ГИБДД</h3>
      <p>Запись на экзамен в ГИБДД выполняется через администратора автошколы после допуска и проверки документов.</p>
      <button type="button" class="secondary" data-section-jump="contacts">Связаться с администратором</button>
    </article>
  `;
}

function renderProgressDetails() {
  const container = qs('#progress-details');
  const activeCount = activeBookings().length;
  const cancelledBookings = state.bookings.filter((booking) => booking.BookingStatus === 'cancelled').length;
  const requiredHours = requiredDrivingHours();
  if (!container) return;

  container.innerHTML = `
    <div class="progress-dashboard">
      <section class="student-panel progress-main-card">
        <div>
          <span class="status new">Общий прогресс</span>
          <strong class="big-progress">${overallProgress()}%</strong>
        </div>
        ${progressBar(overallProgress())}
      </section>
      <section class="student-panel">
        <h3>Теория</h3>
        <p>${theoryPassedCount()} из ${state.theoryTopics.length} тем пройдено.</p>
        ${progressBar(theoryProgress())}
      </section>
      <section class="student-panel">
        <h3>Вождение</h3>
        <p>${drivenHours()} из ${requiredHours} часов. Активных записей: ${activeCount}, отменено: ${cancelledBookings}.</p>
        ${progressBar(practiceProgress())}
      </section>
      <section class="student-panel">
        <h3>Экзамены</h3>
        <p>Теория: ${theoryExamUnlocked() ? 'доступна' : 'закрыта'}. Практика: ${practiceExamUnlocked() ? 'доступна' : 'закрыта'}.</p>
        ${progressBar(examProgress())}
      </section>
    </div>
  `;
}

function renderMaterials() {
  const container = qs('#dashboard-materials');
  const courseFilter = qs('#material-filter-course')?.value || '';
  const materials = state.materials.filter((material) => !courseFilter || String(material.CourseId || '') === courseFilter);
  if (!container) return;

  container.innerHTML = materials.length ? materials.map((material) => `
    <article class="material-card-app">
      <span class="status new">${escapeHtml(material.CourseTitle || 'Общий материал')}</span>
      <h3>${escapeHtml(material.Title)}</h3>
      <p>${escapeHtml(material.Description || 'Описание отсутствует.')}</p>
      <div class="meta">Тип: ${material.FileUrl ? 'ссылка или файл' : 'конспект'}</div>
      ${material.FileUrl ? `<a class="button secondary" href="${escapeHtml(material.FileUrl)}" target="_blank" rel="noopener">Открыть</a>` : '<button class="secondary" disabled>Материал без ссылки</button>'}
    </article>
  `).join('') : '<div class="empty">Материалы по выбранному фильтру не найдены.</div>';
}

function renderContacts() {
  const container = qs('#staff-contacts');
  if (!container) return;

  container.innerHTML = state.staffContacts.length ? state.staffContacts.map((person) => `
    <article class="contact-card">
      <div class="contact-avatar">${escapeHtml(initials(fullName(person)))}</div>
      <div>
        <span class="status ${person.RoleName === 'Admin' ? 'new' : 'available'}">${person.RoleName === 'Admin' ? 'Администратор' : 'Инструктор'}</span>
        <h3>${escapeHtml(fullName(person))}</h3>
        ${person.Category ? `<p>Категории: ${escapeHtml(person.Category)}</p>` : ''}
        ${person.ExperienceYears ? `<p>Опыт: ${escapeHtml(person.ExperienceYears)} лет</p>` : ''}
        <div class="contact-lines">
          <a href="mailto:${escapeHtml(person.Email)}">${escapeHtml(person.Email)}</a>
          <a href="tel:${escapeHtml(person.Phone || '')}">${escapeHtml(person.Phone || 'Телефон не указан')}</a>
        </div>
      </div>
    </article>
  `).join('') : '<div class="empty">Контакты сотрудников пока не найдены.</div>';
}

function renderAll() {
  renderTopbar();
  renderProfile();
  renderLessons();
  renderTheory();
  renderDriving();
  renderExams();
  renderProgressDetails();
  renderMaterials();
  renderContacts();
}

async function loadDashboard() {
  if (!currentStudent) return;

  const [profile, courses, theoryTopics, lessons, bookings, notifications, materials, staffContacts] = await Promise.all([
    apiRequest('/users/me'),
    apiRequest('/courses'),
    apiRequest('/theory-topics'),
    apiRequest('/lessons'),
    apiRequest('/bookings/my'),
    apiRequest('/notifications/my'),
    apiRequest('/materials'),
    apiRequest('/users/staff-contacts')
  ]);

  state.profile = profile;
  state.courses = courses;
  state.theoryTopics = theoryTopics;
  if (!state.theoryTopics.some((topic) => Number(topic.Id) === Number(state.selectedTheoryTopicId))) {
    state.selectedTheoryTopicId = state.theoryTopics[0]?.Id || null;
  }
  state.lessons = lessons;
  state.bookings = bookings;
  state.notifications = notifications;
  state.materials = materials;
  state.staffContacts = staffContacts;
  fillFilters();
  renderAll();
}

function switchSection(section) {
  state.currentSection = section;
  document.querySelectorAll('.student-section').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.section === section);
  });
  document.querySelectorAll('[data-section-target]').forEach((button) => {
    button.classList.toggle('active', button.dataset.sectionTarget === section);
  });

  const titleMap = {
    profile: 'Личные данные',
    schedule: 'Расписание',
    theory: 'Теория',
    driving: 'Вождение',
    exams: 'Экзамены',
    progress: 'Прогресс',
    materials: 'Материалы',
    contacts: 'Связь'
  };
  const descriptionMap = {
    profile: 'Контактные данные используются автошколой для связи и организационных уведомлений.',
    schedule: 'Здесь показаны только ваши активные записи на занятия. Для новой записи используйте вкладки «Теория», «Вождение» и «Экзамены».',
    theory: 'Выберите тему и посмотрите, какие преподаватели открыли свободное время для записи.',
    driving: 'Выберите доступное практическое занятие у инструктора и запишитесь на удобное время.',
    exams: 'Допуск зависит от отмеченного прогресса по теории и вождению.',
    progress: 'Сводка по теории, вождению и экзаменам.',
    materials: 'Конспекты, памятки и ссылки доступны после зачисления.',
    contacts: 'Контакты инструкторов и администраторов для организационных вопросов.'
  };

  qs('#section-title').textContent = titleMap[section] || 'Кабинет';
  qs('#section-description').textContent = descriptionMap[section] || '';
  qs('#student-sidebar')?.classList.remove('open');
}

async function bookLesson(button, message) {
  button.disabled = true;
  setMessage(message, 'Создается запись...');

  try {
    await apiRequest('/bookings', {
      method: 'POST',
      body: { lessonId: Number(button.dataset.bookLesson) }
    });
    setMessage(message, 'Запись успешно создана.', 'success');
    await loadDashboard();
  } catch (error) {
    setMessage(message, error.message, 'error');
    button.disabled = false;
  }
}

async function cancelBooking(button, message) {
  if (!confirm('Отменить запись на занятие?')) return;

  button.disabled = true;
  setMessage(message, 'Отменяется запись...');

  try {
    await apiRequest(`/bookings/${button.dataset.cancelBooking}/cancel`, { method: 'PUT' });
    setMessage(message, 'Запись отменена.', 'success');
    await loadDashboard();
  } catch (error) {
    setMessage(message, error.message, 'error');
    button.disabled = false;
  }
}

function initInteractions() {
  const message = qs('#dashboard-message');

  document.body.addEventListener('click', async (event) => {
    const sectionButton = event.target.closest('[data-section-target]');
    const sectionJump = event.target.closest('[data-section-jump]');
    const theoryTopicButton = event.target.closest('[data-theory-topic]');
    const bookButton = event.target.closest('[data-book-lesson]');
    const cancelButton = event.target.closest('[data-cancel-booking]');
    const notificationToggle = event.target.closest('[data-notification-toggle]');
    const popover = event.target.closest('#notification-popover');

    if (event.target.closest('[data-student-menu-toggle]')) {
      qs('#student-sidebar')?.classList.toggle('open');
      return;
    }

    if (notificationToggle) {
      state.notificationPopoverOpen = !state.notificationPopoverOpen;
      renderNotificationPopover();
      if (state.notificationPopoverOpen) await markVisibleNotificationsRead();
      return;
    }

    if (!popover && state.notificationPopoverOpen) {
      state.notificationPopoverOpen = false;
      renderNotificationPopover();
    }

    if (sectionButton) switchSection(sectionButton.dataset.sectionTarget);
    if (sectionJump) switchSection(sectionJump.dataset.sectionJump);
    if (theoryTopicButton) {
      state.selectedTheoryTopicId = Number(theoryTopicButton.dataset.theoryTopic);
      renderTheory();
    }
    if (bookButton) await bookLesson(bookButton, message);
    if (cancelButton) await cancelBooking(cancelButton, message);

    if (event.target.closest('[data-logout]')) {
      clearSession();
      window.location.href = 'index.html';
    }
  });

  qs('#material-filter-course')?.addEventListener('change', renderMaterials);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!currentStudent) return;
  initInteractions();
  loadDashboard().catch((error) => {
    setMessage(qs('#dashboard-message'), error.message, 'error');
  });
});
})();
