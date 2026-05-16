(function () {
const {
  apiRequest,
  escapeHtml,
  formatDateTime,
  requireAuth,
  setMessage
} = window.AutoSchool;

const notificationsUser = requireAuth(['Applicant', 'Student', 'Instructor', 'Admin']);

function renderNotifications(notifications) {
  const container = document.querySelector('#notifications-list');

  if (!container) {
    return;
  }

  if (!notifications.length) {
    container.innerHTML = '<div class="empty">Уведомлений пока нет.</div>';
    return;
  }

  container.innerHTML = notifications.map((notification) => `
    <article class="list-item notification-card">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(notification.Title)}</h3>
          <div class="meta">${formatDateTime(notification.CreatedAt)} · ${escapeHtml(notification.Channel)}</div>
        </div>
        <span class="status ${notification.IsRead ? 'read' : 'unread'}">${notification.IsRead ? 'Прочитано' : 'Новое'}</span>
      </div>
      <p>${escapeHtml(notification.Message)}</p>
      ${notification.IsRead ? '' : `<div class="card-actions"><button class="secondary" data-read-notification="${notification.Id}">Отметить прочитанным</button></div>`}
    </article>
  `).join('');
}

async function loadNotifications() {
  const notifications = await apiRequest('/notifications/my');
  renderNotifications(notifications);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!notificationsUser) {
    return;
  }

  const message = document.querySelector('#notifications-message');

  loadNotifications().catch((error) => {
    setMessage(message, error.message, 'error');
  });

  document.body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-read-notification]');

    if (!button) {
      return;
    }

    try {
      await apiRequest(`/notifications/${button.dataset.readNotification}/read`, { method: 'PUT' });
      await loadNotifications();
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
});
})();
