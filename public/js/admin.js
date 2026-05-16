(function () {
const {
  apiRequest,
  clearSession,
  escapeHtml,
  formatDateTime,
  requireAuth,
  setMessage
} = window.AutoSchool;

const adminUser = requireAuth(['Admin']);

const state = {
  users: [],
  roles: [],
  instructors: [],
  courses: [],
  theoryTopics: [],
  lessons: [],
  bookings: [],
  materials: [],
  requests: [],
  currentSection: 'students'
};

const labels = {
  available: 'Доступно',
  full: 'Мест нет',
  cancelled: 'Отменено',
  active: 'Активна',
  new: 'Новая',
  in_progress: 'В работе',
  approved: 'Одобрена',
  rejected: 'Отклонена',
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

function fullName(item) {
  return `${item.FirstName || item.StudentFirstName || ''} ${item.LastName || item.StudentLastName || ''}`.trim() || 'Без имени';
}

function instructorName(item) {
  return item.InstructorFirstName ? `${item.InstructorFirstName} ${item.InstructorLastName}` : 'Без инструктора';
}

function safeDateTime(value) {
  return value ? formatDateTime(value) : 'Дата не указана';
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

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'А';
}

function label(value) {
  return labels[value] || value || '-';
}

function money(value) {
  if (value === null || value === undefined || value === '') return 'Цена не указана';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value));
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillSelect(selector, items, getValue, getLabel, emptyLabel) {
  const select = qs(selector);
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` + items.map((item) => (
    `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`
  )).join('');
}

function setFormValues(formId, values) {
  const form = document.getElementById(formId);
  if (!form || !values) return;
  Object.entries(values).forEach(([key, value]) => {
    const input = form.elements[key] || document.getElementById(`${formId.replace('-form', '')}-${key}`);
    if (input) input.value = value ?? '';
  });
}

function resetForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.reset();
  form.querySelectorAll('input[type="hidden"]').forEach((input) => { input.value = ''; });
}

function populateForms() {
  fillSelect('#user-role', state.roles, (role) => role.Id, (role) => role.Name, 'Выберите роль');
  fillSelect('#instructor-user', state.users, (user) => user.Id, (user) => `${fullName(user)} · ${user.Email}`, 'Выберите пользователя');
  fillSelect('#lesson-course', state.courses, (course) => course.Id, (course) => course.Title, 'Выберите курс');
  fillSelect('#lesson-instructor', state.instructors, (instructor) => instructor.Id, fullName, 'Без инструктора');
  fillSelect('#lesson-theory-topic', state.theoryTopics, (topic) => topic.Id, (topic) => topic.Title, 'Без темы');
  fillSelect('#material-course', state.courses, (course) => course.Id, (course) => course.Title, 'Общий материал');
  fillSelect('#notification-user', state.users, (user) => user.Id, (user) => `${fullName(user)} · ${user.Email}`, 'Выберите пользователя');
}

function cardList(selector, items, renderer, emptyText) {
  const container = qs(selector);
  if (!container) return;
  container.innerHTML = items.length ? items.map(renderer).join('') : `<div class="empty">${escapeHtml(emptyText)}</div>`;
}

function activeBookingsForStudent(studentId) {
  return state.bookings.filter((booking) => (
    Number(booking.StudentId) === Number(studentId)
    && booking.BookingStatus === 'active'
    && (!booking.ResultStatus || booking.ResultStatus === 'not_marked')
  ));
}

function renderStudents() {
  const students = state.users.filter((user) => user.RoleName === 'Student');
  cardList('#students-board', students, (student) => {
    const bookings = activeBookingsForStudent(student.Id);
    return `
      <article class="management-card">
        <div class="management-card-head">
          <div>
            <span class="status available">Student</span>
            <h3>${escapeHtml(fullName(student))}</h3>
            <p>${escapeHtml(student.Email)} · ${escapeHtml(student.Phone || 'Телефон не указан')}</p>
          </div>
          <strong>${bookings.length} активных записей</strong>
        </div>
        <div class="compact-list">
          ${bookings.length ? bookings.slice(0, 3).map((booking) => `
            <div class="mini-record">
              <strong>${escapeHtml(booking.LessonTitle)}</strong>
              <span>${formatDateTime(booking.StartDateTime)} · ${escapeHtml(label(booking.LessonType))}</span>
              <span>${escapeHtml(label(booking.ResultStatus || 'not_marked'))}</span>
            </div>
          `).join('') : '<div class="empty">Активных записей нет.</div>'}
        </div>
      </article>
    `;
  }, 'Студенты не найдены.');
}

function renderCalendar() {
  const container = qs('#admin-calendar');
  if (!container) return;
  const sorted = [...state.lessons].sort((a, b) => new Date(a.StartDateTime) - new Date(b.StartDateTime));
  const grouped = [...groupLessonsByDate(sorted).entries()];
  container.innerHTML = `
    <div class="schedule-agenda">
      <div class="schedule-agenda-head">
        <div>
          <h3>Ближайшие занятия</h3>
          <p>Все занятия автошколы отсортированы по дате и времени.</p>
        </div>
        <span class="status new">${sorted.length} занятий</span>
      </div>
      ${grouped.length ? grouped.map(([key, lessons]) => `
        <section class="agenda-day">
          <h4>${escapeHtml(dayTitle(key))}</h4>
          <div class="agenda-list">
            ${lessons.map((lesson) => `
          <article class="student-lesson-card">
            <div class="student-lesson-main">
              <div>
                <h3>${escapeHtml(lesson.Title)}</h3>
                <p>${escapeHtml(lesson.CourseTitle)} · ${escapeHtml(label(lesson.LessonType))}</p>
              </div>
              <span class="status ${escapeHtml(lesson.Status)}">${escapeHtml(label(lesson.Status))}</span>
            </div>
            <div class="lesson-meta-grid">
              <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(lesson.StartDateTime))}</strong></div>
              <div class="lesson-meta-item"><span>Окончание</span><strong>${escapeHtml(safeDateTime(lesson.EndDateTime))}</strong></div>
              <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(lesson))}</strong></div>
              <div class="lesson-meta-item"><span>Записано</span><strong>${escapeHtml(lesson.ActiveBookings || 0)} из ${escapeHtml(lesson.MaxStudents)}</strong></div>
            </div>
          </article>
            `).join('')}
          </div>
        </section>
      `).join('') : '<div class="empty">Занятий пока нет.</div>'}
    </div>
  `;
}

function renderLessons() {
  cardList('#lessons-board', state.lessons, (lesson) => `
    <article class="management-card">
      <div class="management-card-head">
        <div>
          <span class="status ${escapeHtml(lesson.Status)}">${escapeHtml(label(lesson.Status))}</span>
          <h3>${escapeHtml(lesson.Title)}</h3>
          <p>${escapeHtml(lesson.CourseTitle)} · ${escapeHtml(label(lesson.LessonType))}</p>
        </div>
      </div>
      <div class="lesson-meta-grid">
        <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(lesson.StartDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Окончание</span><strong>${escapeHtml(safeDateTime(lesson.EndDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(lesson))}</strong></div>
        <div class="lesson-meta-item"><span>Записано</span><strong>${escapeHtml(lesson.ActiveBookings || 0)} из ${escapeHtml(lesson.MaxStudents)}</strong></div>
      </div>
      <div class="student-card-actions">
        <button class="secondary compact-button" data-edit-lesson="${lesson.Id}">Редактировать</button>
        <button class="danger compact-button" data-delete-lesson="${lesson.Id}">Удалить</button>
      </div>
    </article>
  `, 'Занятия не найдены.');
}

function resultControls(booking) {
  return `
    <div class="result-controls">
      <select data-result-status="${booking.Id}">
        <option value="not_marked" ${!booking.ResultStatus || booking.ResultStatus === 'not_marked' ? 'selected' : ''}>Не отмечено</option>
        <option value="passed" ${booking.ResultStatus === 'passed' ? 'selected' : ''}>Прошел</option>
        <option value="failed" ${booking.ResultStatus === 'failed' ? 'selected' : ''}>Не прошел</option>
      </select>
      <input data-result-hours="${booking.Id}" type="number" min="0" step="0.5" placeholder="Часы" value="${booking.HoursCompleted ?? ''}">
      <input data-result-comment="${booking.Id}" placeholder="Комментарий" value="${escapeHtml(booking.ProgressComment || '')}">
      <button class="compact-button" data-save-result="${booking.Id}">Сохранить</button>
    </div>
  `;
}

function renderResults() {
  const pendingBookings = state.bookings.filter((booking) => (
    booking.BookingStatus === 'active' && (!booking.ResultStatus || booking.ResultStatus === 'not_marked')
  ));

  cardList('#results-board', pendingBookings, (booking) => `
    <article class="management-card">
      <div class="management-card-head">
        <div>
          <span class="status ${escapeHtml(booking.ResultStatus || 'not_marked')}">${escapeHtml(label(booking.ResultStatus || 'not_marked'))}</span>
          <h3>${escapeHtml(booking.StudentFirstName)} ${escapeHtml(booking.StudentLastName)}</h3>
          <p>${escapeHtml(booking.LessonTitle)} · ${escapeHtml(label(booking.LessonType))}</p>
        </div>
      </div>
      <div class="lesson-meta-grid">
        <div class="lesson-meta-item"><span>Начало</span><strong>${escapeHtml(safeDateTime(booking.StartDateTime))}</strong></div>
        <div class="lesson-meta-item"><span>Курс</span><strong>${escapeHtml(booking.CourseTitle)}</strong></div>
        <div class="lesson-meta-item"><span>Инструктор</span><strong>${escapeHtml(instructorName(booking))}</strong></div>
        <div class="lesson-meta-item"><span>Запись</span><strong>${escapeHtml(label(booking.BookingStatus))}</strong></div>
      </div>
      ${resultControls(booking)}
    </article>
  `, 'Записи для отметки результатов не найдены.');
}

function renderUsers() {
  cardList('#users-board', state.users, (user) => `
    <article class="management-card">
      <div class="management-card-head">
        <div><span class="status new">${escapeHtml(user.RoleName)}</span><h3>${escapeHtml(fullName(user))}</h3><p>${escapeHtml(user.Email)} · ${escapeHtml(user.Phone || 'Телефон не указан')}</p></div>
      </div>
      <div class="student-card-actions"><button class="secondary compact-button" data-edit-user="${user.Id}">Редактировать</button></div>
    </article>
  `, 'Пользователи не найдены.');
}

function renderInstructors() {
  cardList('#instructors-board', state.instructors, (instructor) => `
    <article class="management-card">
      <div class="management-card-head">
        <div><span class="status available">Инструктор</span><h3>${escapeHtml(fullName(instructor))}</h3><p>${escapeHtml(instructor.Email)} · ${escapeHtml(instructor.Phone || 'Телефон не указан')}</p></div>
      </div>
      <p>Категории: ${escapeHtml(instructor.Category || '-')} · Опыт: ${escapeHtml(instructor.ExperienceYears || 0)} лет</p>
      <div class="student-card-actions"><button class="secondary compact-button" data-edit-instructor="${instructor.Id}">Редактировать</button><button class="danger compact-button" data-delete-instructor="${instructor.Id}">Удалить</button></div>
    </article>
  `, 'Инструкторы не найдены.');
}

function renderCourses() {
  cardList('#courses-board', state.courses, (course) => `
    <article class="management-card">
      <div class="management-card-head"><div><h3>${escapeHtml(course.Title)}</h3><p>${escapeHtml(course.Description || '')}</p></div><strong>${money(course.Price)}</strong></div>
      <p>Длительность: ${escapeHtml(course.Duration || '-')}</p>
      <p>Часы вождения для допуска: ${escapeHtml(course.RequiredDrivingHours ?? '-')}</p>
      <div class="student-card-actions"><button class="secondary compact-button" data-edit-course="${course.Id}">Редактировать</button><button class="danger compact-button" data-delete-course="${course.Id}">Удалить</button></div>
    </article>
  `, 'Курсы не найдены.');
}

function renderRequests() {
  cardList('#requests-board', state.requests, (request) => `
    <article class="management-card">
      <div class="management-card-head"><div><span class="status ${escapeHtml(request.Status)}">${escapeHtml(label(request.Status))}</span><h3>${escapeHtml(request.FullName)}</h3><p>${escapeHtml(request.CourseTitle)} · ${escapeHtml(request.Phone)} · ${escapeHtml(request.Email)}</p></div></div>
      <p>${escapeHtml(request.Comment || 'Комментарий отсутствует')}</p>
      <div class="student-card-actions">
        <select data-request-status="${request.Id}">
          <option value="new" ${request.Status === 'new' ? 'selected' : ''}>Новая</option>
          <option value="in_progress" ${request.Status === 'in_progress' ? 'selected' : ''}>В работе</option>
          <option value="approved" ${request.Status === 'approved' ? 'selected' : ''}>Одобрена</option>
          <option value="rejected" ${request.Status === 'rejected' ? 'selected' : ''}>Отклонена</option>
        </select>
        <button class="compact-button" data-update-request="${request.Id}">Сохранить</button>
        <button class="danger compact-button" data-delete-request="${request.Id}">Удалить</button>
      </div>
    </article>
  `, 'Заявки не найдены.');
}

function renderMaterials() {
  cardList('#materials-board', state.materials, (material) => `
    <article class="management-card">
      <div class="management-card-head"><div><h3>${escapeHtml(material.Title)}</h3><p>${escapeHtml(material.Description || '')}</p></div></div>
      <p>${escapeHtml(material.CourseTitle || 'Общий материал')}</p>
      <div class="student-card-actions"><button class="secondary compact-button" data-edit-material="${material.Id}">Редактировать</button><button class="danger compact-button" data-delete-material="${material.Id}">Удалить</button></div>
    </article>
  `, 'Материалы не найдены.');
}

function renderAll() {
  populateForms();
  renderStudents();
  renderCalendar();
  renderLessons();
  renderResults();
  renderUsers();
  renderInstructors();
  renderCourses();
  renderRequests();
  renderMaterials();
}

async function loadAdminData() {
  const [users, roles, instructors, courses, theoryTopics, lessons, bookings, materials, requests] = await Promise.all([
    apiRequest('/users'),
    apiRequest('/users/roles'),
    apiRequest('/instructors'),
    apiRequest('/courses'),
    apiRequest('/theory-topics'),
    apiRequest('/lessons'),
    apiRequest('/bookings'),
    apiRequest('/materials'),
    apiRequest('/enrollment-requests')
  ]);

  state.users = users;
  state.roles = roles;
  state.instructors = instructors;
  state.courses = courses;
  state.theoryTopics = theoryTopics;
  state.lessons = lessons;
  state.bookings = bookings;
  state.materials = materials;
  state.requests = requests;
  renderAll();
}

function switchSection(section) {
  state.currentSection = section;
  document.querySelectorAll('.student-section').forEach((panel) => panel.classList.toggle('active', panel.dataset.section === section));
  document.querySelectorAll('[data-section-target]').forEach((button) => button.classList.toggle('active', button.dataset.sectionTarget === section));
  const titles = { students: 'Студенты', schedule: 'Расписание', lessons: 'Занятия', results: 'Результаты', users: 'Пользователи', instructors: 'Инструкторы', courses: 'Курсы', requests: 'Заявки', materials: 'Материалы', notifications: 'Уведомления' };
  const descriptions = {
    students: 'Список обучающихся, их контакты, активные записи и результаты занятий.',
    schedule: 'Единая лента ближайших занятий автошколы по дате и времени.',
    lessons: 'Создание, редактирование и удаление теории, практики и экзаменов.',
    results: 'Отметка по каждой записи: прошел, не прошел или не отмечено. Для практики можно указать часы.',
    users: 'Редактирование контактов и ролей.',
    instructors: 'Профили инструкторов и контактные данные.',
    courses: 'Программы обучения и стоимость.',
    requests: 'Обработка заявок и перевод заявителя в обучение выполняются администратором.',
    materials: 'Учебные ссылки и файлы.',
    notifications: 'Отправка сообщений пользователям внутри сайта.'
  };
  qs('#section-title').textContent = titles[section] || 'Кабинет';
  qs('#section-description').textContent = descriptions[section] || '';
  qs('#admin-sidebar')?.classList.remove('open');
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
  await loadAdminData();
}

function bindForm(formId, handler) {
  qs(`#${formId}`)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#admin-message');
    try {
      await handler(getFormData(event.currentTarget));
      resetForm(formId);
      await loadAdminData();
      setMessage(message, 'Сохранено.', 'success');
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
}

function initForms() {
  bindForm('lesson-form', (data) => apiRequest(data.Id ? `/lessons/${data.Id}` : '/lessons', {
    method: data.Id ? 'PUT' : 'POST',
    body: {
      ...data,
      CourseId: Number(data.CourseId),
      InstructorId: data.InstructorId ? Number(data.InstructorId) : null,
      TheoryTopicId: data.TheoryTopicId ? Number(data.TheoryTopicId) : null,
      MaxStudents: Number(data.MaxStudents)
    }
  }));

  bindForm('user-form', (data) => apiRequest(`/users/${data.Id}`, { method: 'PUT', body: { ...data, RoleId: Number(data.RoleId) } }));
  bindForm('instructor-form', (data) => apiRequest(data.Id ? `/instructors/${data.Id}` : '/instructors', { method: data.Id ? 'PUT' : 'POST', body: { ...data, UserId: Number(data.UserId), ExperienceYears: data.ExperienceYears ? Number(data.ExperienceYears) : null } }));
  bindForm('course-form', (data) => apiRequest(data.Id ? `/courses/${data.Id}` : '/courses', {
    method: data.Id ? 'PUT' : 'POST',
    body: {
      ...data,
      RequiredDrivingHours: data.RequiredDrivingHours ? Number(data.RequiredDrivingHours) : null
    }
  }));
  bindForm('material-form', (data) => apiRequest(data.Id ? `/materials/${data.Id}` : '/materials', { method: data.Id ? 'PUT' : 'POST', body: { ...data, CourseId: data.CourseId ? Number(data.CourseId) : null } }));

  qs('#notification-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = qs('#admin-message');
    try {
      const data = getFormData(event.currentTarget);
      await apiRequest('/notifications', { method: 'POST', body: { ...data, UserId: Number(data.UserId) } });
      event.currentTarget.reset();
      setMessage(message, 'Уведомление отправлено.', 'success');
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
}

function initActions() {
  const message = qs('#admin-message');
  document.body.addEventListener('click', async (event) => {
    const sectionButton = event.target.closest('[data-section-target]');
    const resetButton = event.target.closest('[data-reset-form]');
    const saveResultButton = event.target.closest('[data-save-result]');
    const editUser = event.target.closest('[data-edit-user]')?.dataset.editUser;
    const editInstructor = event.target.closest('[data-edit-instructor]')?.dataset.editInstructor;
    const editCourse = event.target.closest('[data-edit-course]')?.dataset.editCourse;
    const editLesson = event.target.closest('[data-edit-lesson]')?.dataset.editLesson;
    const editMaterial = event.target.closest('[data-edit-material]')?.dataset.editMaterial;

    if (event.target.closest('[data-admin-menu-toggle]')) {
      qs('#admin-sidebar')?.classList.toggle('open');
      return;
    }

    if (sectionButton) switchSection(sectionButton.dataset.sectionTarget);
    if (resetButton) resetForm(resetButton.dataset.resetForm);
    if (saveResultButton) {
      try {
        await saveResult(saveResultButton.dataset.saveResult, message);
      } catch (error) {
        setMessage(message, error.message, 'error');
      }
    }

    if (editUser) setFormValues('user-form', state.users.find((item) => String(item.Id) === editUser));
    if (editInstructor) setFormValues('instructor-form', state.instructors.find((item) => String(item.Id) === editInstructor));
    if (editCourse) setFormValues('course-form', state.courses.find((item) => String(item.Id) === editCourse));
    if (editMaterial) setFormValues('material-form', state.materials.find((item) => String(item.Id) === editMaterial));
    if (editLesson) {
      const lesson = state.lessons.find((item) => String(item.Id) === editLesson);
      setFormValues('lesson-form', { ...lesson, StartDateTime: toDatetimeLocal(lesson.StartDateTime), EndDateTime: toDatetimeLocal(lesson.EndDateTime) });
    }

    const deleteActions = [
      ['data-delete-lesson', '/lessons/', 'Удалить занятие?'],
      ['data-delete-instructor', '/instructors/', 'Удалить инструктора?'],
      ['data-delete-course', '/courses/', 'Удалить курс?'],
      ['data-delete-material', '/materials/', 'Удалить материал?'],
      ['data-delete-request', '/enrollment-requests/', 'Удалить заявку?']
    ];

    for (const [attr, path, question] of deleteActions) {
      const button = event.target.closest(`[${attr}]`);
      if (button && confirm(question)) {
        try {
          await apiRequest(`${path}${button.getAttribute(attr)}`, { method: 'DELETE' });
          setMessage(message, 'Удалено.', 'success');
          await loadAdminData();
        } catch (error) {
          setMessage(message, error.message, 'error');
        }
      }
    }

    const requestButton = event.target.closest('[data-update-request]');
    if (requestButton) {
      try {
        const id = requestButton.dataset.updateRequest;
        const status = qs(`[data-request-status="${id}"]`)?.value;
        await apiRequest(`/enrollment-requests/${id}/status`, { method: 'PUT', body: { Status: status } });
        setMessage(message, 'Статус заявки обновлен.', 'success');
        await loadAdminData();
      } catch (error) {
        setMessage(message, error.message, 'error');
      }
    }

    if (event.target.closest('[data-logout]')) {
      clearSession();
      window.location.href = 'index.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!adminUser) return;
  const name = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Администратор';
  qs('#admin-name').textContent = name;
  initForms();
  initActions();
  loadAdminData().catch((error) => setMessage(qs('#admin-message'), error.message, 'error'));
});
})();
