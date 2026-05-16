(function () {
const { apiRequest, redirectByRole, saveSession, setMessage } = window.AutoSchool;

function formValue(form, name) {
  return form.elements[name]?.value.trim();
}

function redirectAfterMessage(role) {
  window.setTimeout(() => redirectByRole(role), 700);
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const loginPanel = document.querySelector('#login-panel');
  const registerPanel = document.querySelector('#register-panel');
  const message = document.querySelector('#auth-message');

  function showAuthMode(mode, updateHash = true) {
    const isRegister = mode === 'register';

    if (loginPanel) {
      loginPanel.hidden = isRegister;
    }

    if (registerPanel) {
      registerPanel.hidden = !isRegister;
    }

    setMessage(message, '');

    if (updateHash) {
      const url = isRegister ? '#register' : window.location.pathname;
      window.history.replaceState(null, '', url);
    }

    window.setTimeout(() => {
      const field = isRegister
        ? document.querySelector('#register-first-name')
        : document.querySelector('#login-email');
      field?.focus();
    }, 30);
  }

  showAuthMode(window.location.hash === '#register' ? 'register' : 'login', false);

  document.querySelector('[data-show-register]')?.addEventListener('click', () => {
    showAuthMode('register');
  });

  document.querySelector('[data-show-login]')?.addEventListener('click', () => {
    showAuthMode('login');
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, 'Проверяем логин и пароль...');

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email: formValue(loginForm, 'email'),
          password: formValue(loginForm, 'password')
        }
      });

      saveSession(result.token, result.user);
      setMessage(message, 'Вход выполнен. Открываем кабинет...', 'success');
      redirectAfterMessage(result.user.role);
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, 'Создаем аккаунт заявителя...');

    try {
      const result = await apiRequest('/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          firstName: formValue(registerForm, 'firstName'),
          lastName: formValue(registerForm, 'lastName'),
          phone: formValue(registerForm, 'phone'),
          email: formValue(registerForm, 'email'),
          password: formValue(registerForm, 'password')
        }
      });

      saveSession(result.token, result.user);
      setMessage(message, 'Регистрация успешна. Открываем кабинет заявителя...', 'success');
      redirectAfterMessage(result.user.role);
    } catch (error) {
      setMessage(message, error.message, 'error');
    }
  });
});
})();
