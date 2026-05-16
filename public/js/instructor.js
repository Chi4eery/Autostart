(function () {
const {
  apiRequest,
  clearSession,
  escapeHtml,
  formatDateTime,
  requireAuth,
  setMessage
} = window.AutoSchool;

const instructorUser = requireAuth(['Instructor', 'Admin']);

const state = {
  lessons: [],
  courses: [],
  theoryTopics: [],
  currentSection: 'schedule',
  selectedTheoryTopicId: 1
};

const labels = {
  available: 'Доступно',
  full: 'Мест нет',
  cancelled: 'Отменено',
  active: 'Активна',
  theory: 'Теория',
  practice: 'Практика',
  exam: 'Экзамен',
  passed: 'Прошел',
  failed: 'Не прошел',
  not_marked: 'Не отмечено'
};

function qs(selector) {
  return document.querySelector(selector);
}

function label(value) {
  return labels[value] || value || '-';
}

function fullName(item) {
  return `${item.FirstName || ''} ${item.LastName || ''}`.trim() || 'Без имени';
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'И';
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function safeDateTime(value) {
  return value ? formatDateTime(value) : 'Дата не указана';
}

function instructorName(lesson) {
  const name = `${lesson.InstructorFirstName || ''} ${lesson.InstructorLastName || ''}`.trim();
  return name || 'Инструктор не назначен';
}

function lessonDateKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : 'unknown';
}

function dayTitle(key) {
  if (key === 'unknown') return 'Дата не указана';
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupLessonsByDate(lessons) {
  return lessons.reduce((map, lesson) => {
    const key = lessonDateKey(lesson.StartDateTime);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lesson);
    return map;
  }, new Map());
}

function fillCourses() {
  ['#theory-course', '#driving-course'].forEach((selector) => {
    const select = qs(selector);
    if (!select) return;
    select.innerHTML = '<option value="">Выберите курс</option>' + state.courses.map((course) => (
      `<option value="${escapeHtml(course.Id)}">${escapeHtml(course.Title)}</option>`
    )).join('');
  });
}

function fillTheoryTopics() {
  const input = qs('#theory-topic');
  const picker = qs('#theory-topic-picker');
  if (input) input.value = String(state.selectedTheoryTopicId);
  if (!picker) return;

  picker.innerHTML = state.theoryTopics.map((topic) => (
    `<button type="button" class="topic-picker-button ${Number(topic.Id) === Number(state.selectedTheoryTopicId) ? 'active' : ''}" data-pick-theory-topic="${escapeHtml(topic.Id)}">${escapeHtml(topic.Title)}</button>`
  )).join('');
}

function topicTitle(topicId) {
  return state.theoryTopics.find((topic) => Number(topic.Id) === Number(topicId))?.Title || '';
}

function cardList(selector, items, renderer, emptyText) {
  const container = qs(selector);
  if (!container) return;
  container.innerHTML = items.length ? items.map(renderer).join('') : `<div class="empty">${escapeHtml(emptyText)}</div>`;
}

function resultControls(student) {
  return `
    <div class="result-controls">
      <select data-result-status="${student.BookingId}">
        <option value="not_marked" ${!student.ResultStatus || student.ResultStatus === 'not_marked' ? 'selected' : ''}>Не отмечено</option>
        <option value="passed" ${student.ResultStatus === 'passed' ? 'selected' : ''}>Прошел</option>
        <option value="failed" ${student.ResultStatus === 'failed' ? 'selected' : ''}>Не прошел</option>
      </select>
      <input data-result-hours="${student.BookingId}" type="number" min="0" step="0.5" placeholder="Часы" value="${student.HoursCompleted ?? ''}">
      <input data-result-comment="${student.BookingId}" placeholder="Комментарий" value="${escapeHtml(student.ProgressComment || '')}">
      <button class="compact-button" data-save-result="${student.BookingId}">Сохранить</button>
    </div>
  `;
}

function lessonCard(lesson, withStudents = false) {
  return `
    <article class="management-card">
      <div class="management-card-head">
        <div>
          <span class="status ${escapeHtml(lesson.Status)}">${escapeHtml(label(lesson.Status))}</span>
          <h3>${escapeHtml(lesson.Title)}</h3>
          <p>${escapeHtml(lesson.CourseTitle)} · ${escapeHtml(label(lesson.LessonType))}</p>
        </div>
        <strong>${escapeHtml(lesson.BookedCount || 0)} из ${escapeHtml(lesson.MaxStudents)}</strong>
      </div>
      <div class="lesson-meta-grid">
        <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(lesson.StartDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Окончание</span><strong>${escapeHtml(safeDateTime(lesson.EndDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(lesson))}</strong></div>
      </div>
      ${withStudents ? `
        <div class="compact-list">
          ${lesson.Students.length ? lesson.Students.map((student) => `
            <div class="mini-record">
              <strong>${escapeHtml(fullName(student))}</strong>
              <span>${escapeHtml(student.Phone || 'Телефон не указан')} · ${escapeHtml(student.Email)}</span>
              <span>${escapeHtml(label(student.ResultStatus || 'not_marked'))}</span>
            </div>
          `).join('') : '<div class="empty">На занятие пока никто не записан.</div>'}
        </div>
      ` : ''}
    </article>
  `;
}

function renderSchedule() {
  const container = qs('#instructor-schedule');
  if (!container) return;
  const sorted = [...state.lessons].sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
  const grouped = [...groupLessonsByDate(sorted).entries()];

  container.innerHTML = `
    <div class="schedule-agenda">
      <div class="schedule-agenda-head">
        <div>
          <h3>Ближайшие занятия</h3>
          <p>Ваши занятия отсортированы по дате и времени. Внутри карточки видно, сколько студентов записано.</p>
        </div>
        <span class="status new">${sorted.length} занятий</span>
      </div>
      ${grouped.length ? grouped.map(([key, lessons]) => `
        <section class="agenda-day">
          <h4>${escapeHtml(dayTitle(key))}</h4>
          <div class="agenda-list">
            ${lessons.map((lesson) => lessonCard(lesson, true)).join('')}
          </div>
        </section>
      `).join('') : '<div class="empty">Назначенных занятий пока нет.</div>'}
    </div>
  `;
}

function renderStudents() {
  const rows = state.lessons.flatMap((lesson) => lesson.Students.map((student) => ({ ...student, LessonTitle: lesson.Title, LessonType: lesson.LessonType, StartDateTime: lesson.StartDateTime })));
  cardList('#instructor-students', rows, (student) => `
    <article class="management-card">
      <div class="management-card-head">
        <div>
          <span class="status active">Студент</span>
          <h3>${escapeHtml(fullName(student))}</h3>
          <p>${escapeHtml(student.Phone || 'Телефон не указан')} · ${escapeHtml(student.Email)}</p>
        </div>
      </div>
      <p>${escapeHtml(student.LessonTitle)} · ${escapeHtml(label(student.LessonType))} · ${formatDateTime(student.StartDateTime)}</p>
    </article>
  `, 'Записанных студентов пока нет.');
}

function renderLessons() {
  const theoryLessons = state.lessons.filter((lesson) => lesson.LessonType === 'theory');
  const drivingLessons = state.lessons.filter((lesson) => lesson.LessonType === 'practice');
  cardList('#instructor-theory-lessons', theoryLessons, (lesson) => lessonCard(lesson, false), 'Теоретических занятий пока нет.');
  cardList('#instructor-driving-lessons', drivingLessons, (lesson) => lessonCard(lesson, false), 'Практических занятий пока нет.');
}

function renderResults() {
  const rows = state.lessons
    .flatMap((lesson) => lesson.Students.map((student) => ({ ...student, LessonTitle: lesson.Title, LessonType: lesson.LessonType, StartDateTime: lesson.StartDateTime })))
    .filter((student) => !student.ResultStatus || student.ResultStatus === 'not_marked');
  cardList('#instructor-results', rows, (student) => `
    <article class="management-card">
      <div class="management-card-head">
        <div>
          <span class="status ${escapeHtml(student.ResultStatus || 'not_marked')}">${escapeHtml(label(student.ResultStatus || 'not_marked'))}</span>
          <h3>${escapeHtml(fullName(student))}</h3>
          <p>${escapeHtml(student.LessonTitle)} · ${escapeHtml(label(student.LessonType))}</p>
        </div>
      </div>
      <div class="lesson-meta-grid">
        <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(student.StartDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Email</span><strong>${escapeHtml(student.Email)}</strong></div>
        <div class="lesson-meta-item"><span>Телефон</span><strong>${escapeHtml(student.Phone || 'Телефон не указан')}</strong></div>
      </div>
      ${resultControls(student)}
    </article>
  `, 'Нет записей для отметки результата.');
}

function renderAll() {
  fillCourses();
  fillTheoryTopics();
  renderSchedule();
  renderStudents();
  renderLessons();
  renderResults();
}

async function loadInstructorData() {
  const [lessons, courses, theoryTopics] = await Promise.all([
    apiRequest('/instructors/my-lessons'),
    apiRequest('/courses'),
    apiRequest('/theory-topics')
  ]);

  state.lessons = lessons;
  state.courses = courses;
  state.theoryTopics = theoryTopics;
  if (!state.theoryTopics.some((topic) => Number(topic.Id) === Number(state.selectedTheoryTopicId))) {
    state.selectedTheoryTopicId = state.theoryTopics[0]?.Id || null;
  }
  renderAll();
}

function switchSection(section) {
  state.currentSection = section;
  document.querySelectorAll('.student-section').forEach((panel) => panel.classList.toggle('active', panel.dataset.section === section));
  document.querySelectorAll('[data-section-target]').forEach((button) => button.classList.toggle('active', button.dataset.sectionTarget === section));
  const titles = { schedule: 'Расписание', students: 'Студенты', theory: 'Теория', driving: 'Вождение', results: 'Результаты' };
  const descriptions = {
    schedule: 'Ближайшие занятия по порядку: дата, время, тип занятия и записанные студенты.',
    students: 'Обучающиеся, записанные на ваши занятия.',
    theory: 'Выберите тему, укажите дату и время. Студенты увидят этот слот внутри выбранной темы.',
    driving: 'Добавляйте практические занятия в свое расписание. Сервер проверит пересечение по времени.',
    results: 'По каждому студенту можно отметить только результат занятия: прошел или не прошел. Для практики можно указать часы.'
  };
  qs('#section-title').textContent = titles[section] || 'Кабинет';
  qs('#section-description').textContent = descriptions[section] || '';
  qs('#instructor-sidebar')?.classList.remove('open');
}

async function saveResult(bookingId, message) {
  const status = qs(`[data-result-status="${bookingId}"]`)?.value || 'not_marked';
  const hours = qs(`[data-result-hours="${bookingId}"]`)?.value || null;
  const comment = qs(`[data-result-comment="${bookingId}"]`)?.value || '';

  await apiRequest(`/progress/bookings/${bookingId}`, {
    method: 'PUT',
    body: { ResultStatus: status, HoursCompleted: hours, Comment: comment }
  });

  setMessage(message, 'Результат занятия сохранен.', 'success');
  await loadInstructorData();
}

function initActions() {
  const message = qs('#instructor-message');

  document.body.addEventListener('click', async (event) => {
    const sectionButton = event.target.closest('[data-section-target]');
    const resultButton = event.target.closest('[data-save-result]');
    const topicButton = event.target.closest('[data-pick-theory-topic]');

    if (event.target.closest('[data-instructor-menu-toggle]')) {
      qs('#instructor-sidebar')?.classList.toggle('open');
      return;
    }

    if (sectionButton) switchSection(sectionButton.dataset.sectionTarget);

    if (topicButton) {
      state.selectedTheoryTopicId = Number(topicButton.dataset.pickTheoryTopic);
      fillTheoryTopics();
      return;
    }

    if (resultButton) {
      try {
        await saveResult(resultButton.dataset.saveResult, message);
      } catch (error) {
        setMessage(message, error.message, 'error');
      }
    }

    if (event.target.closest('[data-logout]')) {
      clearSession();
      window.location.href = 'index.html';
    }
  });

  qs('#instructor-theory-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = getFormData(event.currentTarget);
      const title = topicTitle(data.TopicId);
      if (!title) {
        setMessage(message, 'Выберите тему теоретического занятия.', 'error');
        return;
      }
      await apiRequest('/instructors/my-lessons', {
        method: 'POST',
        body: {
          CourseId: Number(data.CourseId),
          TheoryTopicId: Number(data.TopicId),
          Title: `Теория: ${title}`,
          LessonType: 'theory',
          StartDateTime: data.StartDateTime,
          EndDateTime: data.EndDateTime,
          MaxStudents: Number(data.MaxStudents),
          Status: 'available'
        }
      });
      event.currentTarget.reset();
      setMessage(message, 'Теоретическое занятие добавлено.', 'success');
      await loadInstructorData();
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });

  qs('#instructor-driving-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = getFormData(event.currentTarget);
      await apiRequest('/instructors/my-lessons', {
        method: 'POST',
        body: {
          CourseId: Number(data.CourseId),
          Title: data.Title,
          LessonType: 'practice',
          StartDateTime: data.StartDateTime,
          EndDateTime: data.EndDateTime,
          MaxStudents: Number(data.MaxStudents),
          Status: 'available'
        }
      });
      event.currentTarget.reset();
      qs('#driving-title').value = 'Практическое занятие';
      setMessage(message, 'Занятие по вождению добавлено.', 'success');
      await loadInstructorData();
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!instructorUser) return;
  const name = `${instructorUser.firstName || ''} ${instructorUser.lastName || ''}`.trim() || 'Инструктор';
  qs('#instructor-name').textContent = name;
  initActions();
  loadInstructorData().catch((error) => setMessage(qs('#instructor-message'), error.message, 'error'));
});
})();
