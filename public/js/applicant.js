(function () {
const {
  apiRequest,
  escapeHtml,
  formatDateTime,
  getCurrentUser,
  money,
  requireAuth,
  setMessage,
  statusLabel
} = window.AutoSchool;

const applicantUser = requireAuth(['Applicant']);
const state = {
  courses: [],
  requests: [],
  notifications: []
};

function selectedCourseId() {
  return new URLSearchParams(window.location.search).get('courseId') || '';
}

function fillProfile() {
  const user = getCurrentUser();
  const nameElement = document.querySelector('#applicant-name');
  const contactSummary = document.querySelector('#applicant-contact-summary');

  if (nameElement && user) {
    const firstName = user.firstName || '';
    nameElement.textContent = firstName
      ? `${firstName}, осталось отправить заявку`
      : 'Осталось отправить заявку';
  }

  if (contactSummary && user) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'ФИО не указано';
    contactSummary.innerHTML = `
      <span>Контакты:</span>
      <strong>${escapeHtml(fullName)}</strong>
      <strong>${escapeHtml(user.phone || 'Телефон не указан')}</strong>
      <strong>${escapeHtml(user.email || 'Email не указан')}</strong>
    `;
  }
}

function fillCourses() {
  const select = document.querySelector('#request-course');

  if (!select) {
    return;
  }

  const selected = selectedCourseId();
  select.innerHTML = '<option value="">Выберите курс</option>' + state.courses.map((course) => {
    const isSelected = String(course.Id) === String(selected) ? ' selected' : '';
    return `<option value="${escapeHtml(course.Id)}"${isSelected}>${escapeHtml(course.Title)} · ${money(course.Price)}</option>`;
  }).join('');
}

function renderStats() {
  const latest = state.requests[0];
  const statusElement = document.querySelector('#applicant-request-status');

  if (statusElement) {
    statusElement.textContent = latest ? 'Заявка отправлена' : 'Отправьте заявку';
    statusElement.classList.toggle('is-complete', Boolean(latest));
  }
}

function renderRequests() {
  const container = document.querySelector('#applicant-requests');

  if (!container) {
    return;
  }

  if (!state.requests.length) {
    container.innerHTML = '<div class="empty">Вы еще не отправляли заявку.</div>';
    return;
  }

  container.innerHTML = state.requests.map((request) => `
    <article class="list-item">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(request.CourseTitle)}</h3>
          <div class="meta">${escapeHtml(request.CourseDuration || 'Срок уточняется')} · ${money(request.CoursePrice)}</div>
        </div>
        <span class="applicant-request-status-text">${escapeHtml(statusLabel(request.Status))}</span>
      </div>
      <p>${escapeHtml(request.Comment || 'Комментарий не указан.')}</p>
      <div class="meta">${formatDateTime(request.CreatedAt)}</div>
    </article>
  `).join('');
}

function renderNotifications() {
  const container = document.querySelector('#applicant-notifications');
  const visible = state.notifications.slice(0, 5);

  if (!container) {
    return;
  }

  if (!visible.length) {
    container.innerHTML = '<div class="empty">Уведомлений пока нет.</div>';
    return;
  }

  container.innerHTML = visible.map((notification) => `
    <article class="applicant-notification-item ${notification.IsRead ? 'is-read' : 'is-unread'}">
      <div>
        <h3>${escapeHtml(notification.Title)}</h3>
        <p>${escapeHtml(notification.Message)}</p>
      </div>
      <time>${formatDateTime(notification.CreatedAt)}</time>
    </article>
  `).join('');
}

function renderAll() {
  fillCourses();
  fillProfile();
  renderStats();
  renderRequests();
  renderNotifications();
}

async function loadApplicant() {
  const [courses, requests, notifications] = await Promise.all([
    apiRequest('/courses'),
    apiRequest('/enrollment-requests/my'),
    apiRequest('/notifications/my')
  ]);

  state.courses = courses;
  state.requests = requests;
  state.notifications = notifications;
  renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!applicantUser) {
    return;
  }

  const message = document.querySelector('#applicant-message');
  fillProfile();

  loadApplicant().catch((error) => {
    setMessage(message, error.message, 'error');
  });

  document.querySelector('#applicant-request-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const result = await apiRequest('/enrollment-requests', {
        method: 'POST',
        body: data
      });

      setMessage(message, result.message || 'Заявка отправлена. Администратор свяжется с вами', 'success');
      form.elements.Comment.value = '';
      await loadApplicant();
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
});
})();
