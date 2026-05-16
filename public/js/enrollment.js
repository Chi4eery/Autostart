(function () {
const {
  apiRequest,
  escapeHtml,
  getCurrentUser,
  money,
  setMessage
} = window.AutoSchool;

const state = {
  courses: []
};

function selectedCourseId() {
  return new URLSearchParams(window.location.search).get('courseId') || '';
}

function userFullName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
}

function renderProfile(user) {
  const container = document.querySelector('#enrollment-profile');

  if (!container || !user) {
    return;
  }

  container.innerHTML = `
    <div class="list-item">
      <strong>${escapeHtml(userFullName(user) || 'Имя не указано')}</strong>
      <span class="meta">ФИО</span>
    </div>
    <div class="list-item">
      <strong>${escapeHtml(user.phone || 'Телефон не указан')}</strong>
      <span class="meta">Телефон</span>
    </div>
    <div class="list-item">
      <strong>${escapeHtml(user.email || 'Email не указан')}</strong>
      <span class="meta">Email</span>
    </div>
  `;
}

function fillCourses() {
  const select = document.querySelector('#page-enrollment-course');

  if (!select) {
    return;
  }

  const selected = selectedCourseId();
  select.innerHTML = '<option value="">Выберите курс</option>' + state.courses.map((course) => {
    const isSelected = String(course.Id) === String(selected) ? ' selected' : '';
    return `<option value="${escapeHtml(course.Id)}"${isSelected}>${escapeHtml(course.Title)} · ${escapeHtml(course.Duration || 'срок уточняется')} · ${money(course.Price)}</option>`;
  }).join('');
}

function showMode(user) {
  const guestBlock = document.querySelector('#guest-enrollment');
  const authorizedBlock = document.querySelector('#authorized-enrollment');

  if (guestBlock) {
    guestBlock.hidden = Boolean(user);
  }

  if (authorizedBlock) {
    authorizedBlock.hidden = !user;
  }
}

async function loadEnrollmentPage() {
  const user = getCurrentUser();
  showMode(user);

  if (user) {
    renderProfile(user);
  }

  state.courses = await apiRequest('/courses', { auth: false });
  fillCourses();
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  const message = document.querySelector('#enrollment-page-message');
  const form = document.querySelector('#enrollment-page-form');

  loadEnrollmentPage().catch((error) => {
    setMessage(message, error.message, 'error');
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentUser = getCurrentUser();

    if (!currentUser) {
      window.location.href = 'login.html#register';
      return;
    }

    if (!currentUser.phone) {
      setMessage(message, 'В вашем аккаунте не указан телефон. Укажите телефон при регистрации или сообщите его администратору.', 'error');
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const result = await apiRequest('/enrollment-requests', {
        method: 'POST',
        body: {
          CourseId: data.CourseId,
          FullName: userFullName(currentUser),
          Phone: currentUser.phone,
          Email: currentUser.email,
          Comment: data.Comment
        }
      });

      setMessage(message, result.message || 'Заявка отправлена. Администратор свяжется с вами', 'success');
      form.elements.Comment.value = '';
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
});
})();
