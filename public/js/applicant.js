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

function fillProfile() {
  const user = getCurrentUser();
  const nameElement = document.querySelector('#applicant-name');

  if (nameElement && user) {
    nameElement.textContent = `${user.firstName} ${user.lastName}`;
  }
}

function fillCourses() {
  const select = document.querySelector('#request-course');

  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Выберите курс</option>' + state.courses.map((course) => (
    `<option value="${escapeHtml(course.Id)}">${escapeHtml(course.Title)} · ${money(course.Price)}</option>`
  )).join('');
}

function renderStats() {
  const latest = state.requests[0];
  const unread = state.notifications.filter((notification) => !notification.IsRead).length;

  document.querySelector('#stat-requests').textContent = String(state.requests.length);
  document.querySelector('#stat-latest').textContent = latest ? statusLabel(latest.Status) : 'Нет заявки';
  document.querySelector('#stat-notifications').textContent = String(unread);
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
        <span class="status ${escapeHtml(request.Status)}">${escapeHtml(statusLabel(request.Status))}</span>
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
    <article class="list-item notification-card">
      <div class="card-header">
        <h3>${escapeHtml(notification.Title)}</h3>
        <span class="status ${notification.IsRead ? 'read' : 'unread'}">${notification.IsRead ? 'Прочитано' : 'Новое'}</span>
      </div>
      <p>${escapeHtml(notification.Message)}</p>
      <div class="meta">${formatDateTime(notification.CreatedAt)}</div>
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
