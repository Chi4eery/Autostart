(function () {
const {
  apiRequest,
  escapeHtml,
  formatDateTime,
  requireAuth,
  setMessage
} = window.AutoSchool;

const materialsUser = requireAuth(['Student', 'Instructor', 'Admin']);

function renderMaterials(materials) {
  const container = document.querySelector('#materials-list');

  if (!container) {
    return;
  }

  if (!materials.length) {
    container.innerHTML = '<div class="empty">Учебные материалы пока не добавлены.</div>';
    return;
  }

  container.innerHTML = materials.map((material) => `
    <article class="card material-card">
      <div class="card-header">
        <div>
          <h3>${escapeHtml(material.Title)}</h3>
          <div class="meta">${escapeHtml(material.CourseTitle || 'Общий материал')}</div>
        </div>
        <span class="status">${formatDateTime(material.CreatedAt)}</span>
      </div>
      <p>${escapeHtml(material.Description || 'Описание отсутствует.')}</p>
      ${material.FileUrl ? `<a class="button secondary" href="${escapeHtml(material.FileUrl)}" target="_blank" rel="noopener">Открыть материал</a>` : '<span class="meta">Файл не прикреплен</span>'}
    </article>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!materialsUser) {
    return;
  }

  const message = document.querySelector('#materials-message');

  try {
    const materials = await apiRequest('/materials');
    renderMaterials(materials);
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
});
})();
