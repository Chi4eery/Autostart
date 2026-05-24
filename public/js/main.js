(function () {
const { apiRequest, escapeHtml, getCurrentUser, money } = window.AutoSchool;

function renderCourses(courses) {
  const container = document.querySelector('#courses-list');

  if (!container) {
    return;
  }

  if (!courses.length) {
    container.innerHTML = '<div class="empty">Курсы пока не добавлены.</div>';
    return;
  }

  container.innerHTML = courses.map((course) => {
    const title = String(course.Title || '');
    const isRefresh = title.toLowerCase().includes('восстанов');
    const fallbackDescription = isRefresh
      ? 'Индивидуальные занятия для тех, кто хочет вернуть уверенность за рулем, отработать город, парковку и сложные маневры.'
      : 'Полный курс подготовки водителей легковых автомобилей: теория, практика и подготовка к экзаменационному маршруту.';
    const description = String(course.Description || fallbackDescription)
      .replace('теория, тренажер и практика', 'теория, практика и подготовка к экзаменационному маршруту');
    const details = isRefresh
      ? ['Формат: практика с инструктором', 'Подходит: после перерыва в вождении']
      : ['Формат: теория + практика', 'В кабинете видно расписание, материалы и важные сообщения'];

    return `
    <article class="course-offer-card">
      <h3>${escapeHtml(course.Title)}</h3>
      <p>${escapeHtml(description)}</p>
      <ul class="offer-list">
        <li>Срок: ${escapeHtml(course.Duration || 'уточняется')}</li>
        ${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}
      </ul>
      <div class="offer-footer">
        <span class="price">${money(course.Price)}</span>
      </div>
      <div class="card-actions">
        <button type="button" data-open-enrollment data-course-id="${escapeHtml(course.Id)}">Оставить заявку</button>
      </div>
    </article>
  `;
  }).join('');
}

function formatYears(value) {
  const years = Number(value) || 0;
  const lastTwo = years % 100;
  const last = years % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${years} лет`;
  }

  if (last === 1) {
    return `${years} год`;
  }

  if (last >= 2 && last <= 4) {
    return `${years} года`;
  }

  return `${years} лет`;
}

function openEnrollmentPage(courseId = '') {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  const user = getCurrentUser();

  if (user?.role === 'Applicant') {
    window.location.href = `applicant.html${query}`;
    return;
  }

  window.location.href = `enrollment.html${query}`;
}

function renderInstructors(instructors) {
  const container = document.querySelector('#instructors-list');

  if (!container) {
    return;
  }

  if (!instructors.length) {
    container.innerHTML = '<div class="empty">Инструкторы пока не добавлены.</div>';
    return;
  }

  container.innerHTML = instructors.map((instructor) => `
    <article class="instructor-profile-card">
      <div class="instructor-avatar">${escapeHtml((instructor.FirstName || 'И').slice(0, 1))}</div>
      <h3>${escapeHtml(instructor.FirstName)} ${escapeHtml(instructor.LastName)}</h3>
      <p>${escapeHtml(instructor.Description || 'Инструктор автошколы АвтоСтарт.')}</p>
      <div class="instructor-meta">
        <span>Категория: ${escapeHtml(instructor.Category || 'не указана')}</span>
        <span>Опыт: ${escapeHtml(formatYears(instructor.ExperienceYears))}</span>
      </div>
    </article>
  `).join('');
}

async function loadHomePage() {
  const [courses, instructors] = await Promise.all([
    apiRequest('/courses', { auth: false }),
    apiRequest('/instructors', { auth: false })
  ]);

  renderCourses(courses);
  renderInstructors(instructors);
}

function initEnrollmentForm() {
  document.body.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-enrollment]');

    if (openButton) {
      openEnrollmentPage(openButton.dataset.courseId || '');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEnrollmentForm();

  loadHomePage().catch((error) => {
    const courses = document.querySelector('#courses-list');
    const instructors = document.querySelector('#instructors-list');
    const message = '<div class="empty">Не удалось загрузить данные. Проверьте сервер и подключение к базе.</div>';

    if (courses) {
      courses.innerHTML = message;
    }

    if (instructors) {
      instructors.innerHTML = message;
    }

    console.error(error);
  });
});
})();
