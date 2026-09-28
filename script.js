/**
 * ==========================================================================
 * EDITORIAL BRUTALIST INTERACTION SCRIPT
 * Maxim Lungu — Admissions Consultant (2026)
 * ==========================================================================
 */

const CONFIG = {
  managerName: "Максим Лунгу",
  telegramUsername: "mss44zak",
  googleSheetWebhookUrl: "https://script.google.com/macros/s/AKfycbx-rRZjjGRkn3HxybKTJxpONNn6VD-40v5Cs9G99AvBzpUxZCalabIqlio7Ni3exXE3_A/exec"
};

document.addEventListener('DOMContentLoaded', () => {
  initPosterAnimation();
  initStickyHeader();
  initTimelineAnimation();
  initModal();
  initFormPills();
  initPhoneMask();
  initFormSubmission();
  initSmoothScroll();
});

/* --- 0. POSTER FOG ANIMATION CLEANUP --- */
/* После конца всех анимаций сразу убираем animation с элементов.
   Это не даёт браузеру держать GPU-слои лишнюю секунду и snap-ать. */
function initPosterAnimation() {
  const posterEl = document.querySelector('.poster-hero-vermilion');
  if (!posterEl) return;

  const ANIMATED_SELECTORS = [
    '.poster-top-bar',
    '.poster-nav-row',
    '.poster-letters-col',
    '.poster-right-caption',
    '.poster-meta-rules'
  ];

  // Самая последняя анимация: fogLineReveal delay=1.2s + duration=1.4s = 2.6s
  // Добавляем 50ms запас
  const LAST_ANIM_END_MS = (1.2 + 1.4) * 1000 + 50;

  setTimeout(() => {
    // Убираем animation со всех дочерних элементов — они уже в финальной позиции
    ANIMATED_SELECTORS.forEach(sel => {
      const el = posterEl.querySelector(sel);
      if (el) el.style.animation = 'none';
    });
    // Убираем fog veil псевдо-элемент через класс
    posterEl.classList.add('fog-settled');
  }, LAST_ANIM_END_MS);
}


/* --- 1. STICKY HEADER SCROLL STATE --- */
function initStickyHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* --- 2. TIMELINE HAIRLINE PROGRESS ANIMATION --- */
function initTimelineAnimation() {
  const processSection = document.getElementById('process');
  const progressLine = document.getElementById('timelineProgress');
  if (!processSection || !progressLine) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          progressLine.style.width = '100%';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });

    observer.observe(processSection);
  } else {
    progressLine.style.width = '100%';
  }
}

/* --- 3. MINIMALIST FULLSCREEN / OVERLAY MODAL --- */
function initModal() {
  const modal = document.getElementById('consultationModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const backdrop = document.getElementById('modalBackdrop');
  const doneBtn = document.getElementById('modalDoneBtn');
  const triggers = document.querySelectorAll('.btn-consultation-trigger');
  const formView = document.getElementById('modalFormView');
  const successView = document.getElementById('modalSuccessView');
  const nameInput = document.getElementById('userName');

  if (!modal) return;

  const openModal = () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Reset views
    if (formView) formView.classList.add('active');
    if (successView) successView.classList.remove('active');

    // Anti-Bot: запоминаем время открытия формы (time-trap)
    const formLoadTimeInput = document.getElementById('formLoadTime');
    if (formLoadTimeInput) formLoadTimeInput.value = Date.now().toString();

    // Focus first input
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 200);
  };

  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  triggers.forEach(btn => btn.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (doneBtn) doneBtn.addEventListener('click', closeModal);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/* --- 3.5. FORM PILL SELECTION (LEVEL & INSTITUTION) --- */
function initFormPills() {
  document.querySelectorAll('.form-pill-group').forEach(group => {
    const parentField = group.closest('.form-field');
    const hiddenInput = parentField ? parentField.querySelector('input[type="hidden"]') : null;

    group.querySelectorAll('.form-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        group.querySelectorAll('.form-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (hiddenInput) {
          hiddenInput.value = pill.dataset.value;
        }
      });
    });
  });
}

/* --- 4. PHONE NUMBER FORMATTING MASK --- */
function initPhoneMask() {
  const phoneInput = document.getElementById('userPhone');
  if (!phoneInput) return;

  phoneInput.addEventListener('input', (e) => {
    let input = e.target;
    let numbers = input.value.replace(/\D/g, '');
    let formatted = '';

    if (!numbers) {
      input.value = '';
      return;
    }

    // Replace initial 8 with 7 for uniform Russian numbers
    if (['7', '8', '9'].includes(numbers[0])) {
      if (numbers[0] === '9') numbers = '7' + numbers;
      let firstChar = '+7';
      formatted = firstChar + ' ';

      if (numbers.length > 1) {
        formatted += '(' + numbers.substring(1, 4);
      }
      if (numbers.length >= 5) {
        formatted += ') ' + numbers.substring(4, 7);
      }
      if (numbers.length >= 8) {
        formatted += '-' + numbers.substring(7, 9);
      }
      if (numbers.length >= 10) {
        formatted += '-' + numbers.substring(9, 11);
      }
    } else {
      formatted = '+' + numbers.substring(0, 16);
    }

    input.value = formatted;
  });

  phoneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && e.target.value.replace(/\D/g, '').length === 1) {
      e.target.value = '';
    }
  });
}

/* --- 5. FORM SUBMISSION & CRM INTEGRATION (С АНТИ-БОТ ЗАЩИТОЙ) --- */
function initFormSubmission() {
  const form = document.getElementById('consultationForm');
  const nameInput = document.getElementById('userName');
  const phoneInput = document.getElementById('userPhone');
  const nameError = document.getElementById('nameError');
  const phoneError = document.getElementById('phoneError');
  const submitBtn = document.getElementById('submitBtn');
  const formView = document.getElementById('modalFormView');
  const successView = document.getElementById('modalSuccessView');

  if (!form) return;

  // ==========================================
  // ANTI-BOT: Rate Limiter (макс. 3 заявки за 10 минут)
  // ==========================================
  const RATE_LIMIT_MAX = 3;
  const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 минут

  function isRateLimited() {
    try {
      const history = JSON.parse(localStorage.getItem('_crm_submit_times') || '[]');
      const now = Date.now();
      const recent = history.filter(ts => (now - ts) < RATE_LIMIT_WINDOW_MS);
      localStorage.setItem('_crm_submit_times', JSON.stringify(recent));
      return recent.length >= RATE_LIMIT_MAX;
    } catch { return false; }
  }

  function recordSubmission() {
    try {
      const history = JSON.parse(localStorage.getItem('_crm_submit_times') || '[]');
      history.push(Date.now());
      localStorage.setItem('_crm_submit_times', JSON.stringify(history.slice(-20)));
    } catch {}
  }

  // ==========================================
  // ANTI-BOT: Time-Trap (форма заполнена < 3 сек = бот)
  // ==========================================
  const MIN_FILL_TIME_MS = 3000;

  function isTooFast() {
    const loadTimeEl = document.getElementById('formLoadTime');
    if (!loadTimeEl || !loadTimeEl.value) return false;
    const elapsed = Date.now() - parseInt(loadTimeEl.value, 10);
    return elapsed < MIN_FILL_TIME_MS;
  }

  // ==========================================
  // ANTI-BOT: Honeypot check
  // ==========================================
  function isHoneypotFilled() {
    const honeypot = document.getElementById('websiteUrl');
    return honeypot && honeypot.value.length > 0;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ---- ANTI-BOT CHECKS ----
    // 1. Honeypot: скрытое поле заполнено → бот
    if (isHoneypotFilled()) {
      console.warn('🛡️ Honeypot triggered — submission blocked.');
      // Имитируем успех, чтобы бот не понял что заблокирован
      if (formView && successView) {
        formView.classList.remove('active');
        successView.classList.add('active');
      }
      return;
    }

    // 2. Time-trap: слишком быстро → бот
    if (isTooFast()) {
      console.warn('🛡️ Time-trap triggered — submission blocked.');
      if (formView && successView) {
        formView.classList.remove('active');
        successView.classList.add('active');
      }
      return;
    }

    // 3. Rate-limit: слишком много заявок подряд
    if (isRateLimited()) {
      if (phoneError) phoneError.textContent = 'Слишком много заявок. Попробуйте через 10 минут.';
      return;
    }

    let isValid = true;
    // Очищаем все ошибки
    const surnameError = document.getElementById('surnameError');
    const birthdateError = document.getElementById('birthdateError');
    if (nameError) nameError.textContent = '';
    if (phoneError) phoneError.textContent = '';
    if (surnameError) surnameError.textContent = '';
    if (birthdateError) birthdateError.textContent = '';

    // Считываем поля
    const surnameInput = document.getElementById('userSurname');
    const patronymicInput = document.getElementById('userPatronymic');
    const birthdateInput = document.getElementById('userBirthdate');
    const telegramInput = document.getElementById('userTelegram');

    const surnameVal = surnameInput ? surnameInput.value.trim() : '';
    const nameVal = nameInput.value.trim();
    const patronymicVal = patronymicInput ? patronymicInput.value.trim() : '';
    const birthdateVal = birthdateInput ? birthdateInput.value : '';
    const phoneVal = phoneInput.value.trim();
    const phoneDigits = phoneVal.replace(/\D/g, '');
    const telegramVal = telegramInput ? telegramInput.value.trim() : '';

    // Валидация: только буквы, пробелы, дефисы
    const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,60}$/;

    // Фамилия (обязательна)
    if (!surnameVal) {
      if (surnameError) surnameError.textContent = 'Пожалуйста, укажите фамилию';
      if (surnameInput) surnameInput.focus();
      isValid = false;
    } else if (!nameRegex.test(surnameVal)) {
      if (surnameError) surnameError.textContent = 'Фамилия может содержать только буквы';
      if (surnameInput) surnameInput.focus();
      isValid = false;
    }

    // Имя (обязательно)
    if (!nameVal) {
      if (nameError) nameError.textContent = 'Пожалуйста, укажите имя';
      if (isValid) nameInput.focus();
      isValid = false;
    } else if (!nameRegex.test(nameVal)) {
      if (nameError) nameError.textContent = 'Имя может содержать только буквы';
      if (isValid) nameInput.focus();
      isValid = false;
    }

    // Дата рождения (обязательна)
    if (!birthdateVal) {
      if (birthdateError) birthdateError.textContent = 'Укажите дату рождения';
      if (isValid && birthdateInput) birthdateInput.focus();
      isValid = false;
    }

    // Телефон
    if (!phoneVal || phoneDigits.length < 11) {
      if (phoneError) phoneError.textContent = 'Укажите корректный номер телефона (11 цифр)';
      if (isValid) phoneInput.focus();
      isValid = false;
    }

    if (!isValid) return;

    // Loading State
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>ОТПРАВКА...</span>';

    // Считываем выбранные параметры
    const levelVal = document.getElementById('userLevel')?.value || 'Вуз (Бакалавриат)';
    const institutionVal = document.getElementById('userInstitution')?.value || '«Синергия»';
    const facultyVal = document.getElementById('userFaculty')?.value || 'IT, разработка и ИИ';

    // Собираем полное ФИО
    let fullName = surnameVal + ' ' + nameVal;
    if (patronymicVal) fullName += ' ' + patronymicVal;

    // Форматируем телефон в чистый вид 8XXXXXXXXXX (11 цифр)
    let digits = phoneVal.replace(/\D/g, '');
    let formattedPhone = digits;
    if (digits.length === 11) {
      formattedPhone = '8' + digits.slice(1);
    } else if (digits.length === 10) {
      formattedPhone = '8' + digits;
    }

    // Чистим Telegram username
    let cleanTelegram = telegramVal.replace(/^@/, '').trim();

    // Lead Payload (с анти-бот метаданными)
    const payload = {
      name: fullName,
      surname: surnameVal,
      firstName: nameVal,
      patronymic: patronymicVal,
      birthdate: birthdateVal,
      phone: formattedPhone,
      telegram: cleanTelegram,
      level: levelVal,
      institution: institutionVal,
      faculty: facultyVal,
      source: "Запись на консультацию",
      notes: `${levelVal} • ${institutionVal} • ${facultyVal}`,
      url: window.location.href,
      submittedAt: new Date().toISOString(),
      // Anti-bot metadata для серверной проверки
      _hp: document.getElementById('websiteUrl')?.value || '',
      _ft: document.getElementById('formLoadTime')?.value || ''
    };

    // Фиксируем отправку в rate-limiter
    recordSubmission();

    // Сохраняем локально в браузере (резервная копия на случай сбоя сети)
    try {
      const existingLeads = JSON.parse(localStorage.getItem('saved_crm_leads') || '[]');
      existingLeads.unshift(payload);
      localStorage.setItem('saved_crm_leads', JSON.stringify(existingLeads.slice(0, 50)));
    } catch (storageErr) {
      console.warn('Local storage error:', storageErr);
    }

    // Отправка в Google Apps Script CRM Webhook
    if (CONFIG.googleSheetWebhookUrl && CONFIG.googleSheetWebhookUrl.startsWith('http')) {
      try {
        await fetch(CONFIG.googleSheetWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('CRM dispatch notice:', err);
      }
    } else {
      console.log('⚡ Заявка зафиксирована локально (укажите googleSheetWebhookUrl в script.js):', payload);
    }

    // Reset and show success view
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    form.reset();

    if (formView && successView) {
      formView.classList.remove('active');
      successView.classList.add('active');
    }
  });
}

/* --- 6. SMOOTH SCROLL ANCHORS --- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
