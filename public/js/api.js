(function () {
const API_BASE = '/api';
const TOKEN_KEY = 'autoschool_token';
const USER_KEY = 'autoschool_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const hasBody = options.body !== undefined;

  if (hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: hasBody && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Ошибка запроса к серверу');
  }

  return data;
}

function redirectByRole(role) {
  window.location.href = getCabinetUrl(role);
}

function getCabinetUrl(role) {
  if (role === 'Admin') {
    return 'admin.html';
  }

  if (role === 'Instructor') {
    return 'instructor.html';
  }

  if (role === 'Applicant') {
    return 'applicant.html';
  }

  return 'dashboard.html';
}

function requireAuth(roles) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = 'login.html';
    return null;
  }

  if (Array.isArray(roles) && !roles.includes(user.role)) {
    redirectByRole(user.role);
    return null;
  }

  return user;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function statusLabel(value) {
  const labels = {
    available: 'Доступно',
    full: 'Мест нет',
    cancelled: 'Отменено',
    active: 'Активна',
    read: 'Прочитано',
    unread: 'Новое',
    new: 'Новая',
    in_progress: 'В работе',
    approved: 'Одобрена',
    rejected: 'Отклонена'
  };

  return labels[value] || value || '—';
}

function lessonTypeLabel(value) {
  const labels = {
    theory: 'Теория',
    practice: 'Практика'
  };

  return labels[value] || value || '—';
}

function money(value) {
  if (value === null || value === undefined) {
    return 'Цена уточняется';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function setMessage(element, text, type = '') {
  if (!element) {
    return;
  }

  element.textContent = text || '';
  element.className = `message ${type}`.trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initLayout() {
  const user = getCurrentUser();
  const userBadges = document.querySelectorAll('.user-badge');
  const authLinks = document.querySelectorAll('[data-auth-link]');
  const cabinetLinks = document.querySelectorAll('[data-cabinet-link]');
  const logoutButtons = document.querySelectorAll('[data-logout]');

  userBadges.forEach((badge) => {
    badge.textContent = '';
    badge.hidden = true;
  });

  authLinks.forEach((link) => {
    link.hidden = Boolean(user);
  });

  cabinetLinks.forEach((link) => {
    link.hidden = !user;

    if (user) {
      link.href = getCabinetUrl(user.role);
    }
  });

  logoutButtons.forEach((button) => {
    button.hidden = !user;
    button.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });
  });
}

document.addEventListener('DOMContentLoaded', initLayout);

window.AutoSchool = {
  apiRequest,
  clearSession,
  escapeHtml,
  formatDateTime,
  getCurrentUser,
  getToken,
  getCabinetUrl,
  money,
  redirectByRole,
  requireAuth,
  saveSession,
  setMessage,
  statusLabel,
  lessonTypeLabel
};
})();
