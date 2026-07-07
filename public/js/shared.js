/* shared.js — injects header and footer into every page */
(function () {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const navLinks = [
    { href: 'index.html',    label: 'Главная' },
    { href: 'services.html', label: 'Услуги' },
    { href: 'gallery.html',  label: 'Галерея' },
    { href: 'masters.html',  label: 'Мастера' },
    { href: 'reviews.html',  label: 'Отзывы' },
    { href: 'training.html', label: 'Обучение' },
    { href: 'careers.html',  label: 'Карьера' },
    { href: 'contacts.html', label: 'Контакты' },
  ];

  const bookingUrl = "https://vk.com/indial59?w=app51715800_-104632367";

  const navHTML = navLinks
    .map(l => `<a href="${l.href}" class="nav-link${currentPage === l.href ? ' active' : ''}">${l.label}</a>`)
    .join('');

  const mobileNavHTML = navLinks
    .map(l => `<a href="${l.href}" class="nav-link${currentPage === l.href ? ' active' : ''}">${l.label}</a>`)
    .join('');

  const headerEl = document.getElementById('site-header');
  if (headerEl) {
    headerEl.innerHTML = `
      <div class="container header-inner">
        <a href="index.html" class="logo">INDIAL</a>
        <nav class="main-nav" id="main-nav">${navHTML}</nav>
        <div style="display:flex;align-items:center;gap:1.5rem;">
          <a href="${bookingUrl}" target="_blank" class="header-book">Записаться</a>
          <button class="burger" id="burger-btn" aria-label="Меню">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    `;
  }

  // Mobile nav overlay (drawer format)
  const mobileNavEl = document.getElementById('mobile-nav');
  if (mobileNavEl) {
    mobileNavEl.innerHTML = `
      <div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>
      <div class="mobile-nav-drawer">
        <button class="mobile-drawer-close" id="mobile-drawer-close">&times;</button>
        <nav class="mobile-drawer-links">
          ${mobileNavHTML}
        </nav>
      </div>
    `;
  }

  // Burger toggle & click listener
  document.addEventListener('click', function (e) {
    const btn = document.getElementById('burger-btn');
    const mob = document.getElementById('mobile-nav');
    const overlay = document.getElementById('mobile-nav-overlay');
    const drawerClose = document.getElementById('mobile-drawer-close');

    if (btn && mob && (btn === e.target || btn.contains(e.target))) {
      mob.classList.toggle('open');
    } else if (mob && mob.classList.contains('open')) {
      if (e.target === overlay || e.target === drawerClose) {
        mob.classList.remove('open');
      } else if (e.target.closest('.mobile-drawer-links a')) {
        mob.classList.remove('open');
      }
    }
  });

  /* Footer */
  const footerEl = document.getElementById('site-footer');
  if (footerEl) {
    footerEl.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">INDIAL</div>
            <p class="footer-desc">ИНДИАЛ — студия здорового окрашивания и академия колористики в Перми. Создаем цвет, который сохраняет качество волос, и обучаем мастеров.</p>
          </div>
          <div>
            <p class="footer-col-title">Разделы</p>
            <ul class="footer-links">
              <li><a href="index.html"    class="footer-link">Главная</a></li>
              <li><a href="services.html" class="footer-link">Окрашивание и восстановление</a></li>
              <li><a href="gallery.html"  class="footer-link">Галерея</a></li>
              <li><a href="masters.html"  class="footer-link">Мастера</a></li>
              <li><a href="reviews.html"  class="footer-link">Отзывы</a></li>
              <li><a href="training.html" class="footer-link">Обучение</a></li>
              <li><a href="careers.html"  class="footer-link">Карьера</a></li>
              <li><a href="contacts.html" class="footer-link">Контакты</a></li>
            </ul>
          </div>
          <div>
            <p class="footer-col-title">Контакты</p>
            <ul class="footer-links">
              <li class="footer-link">ул. Елькина, 14, Пермь</li>
              <li class="footer-link">Этаж 1, офис 7</li>
              <li><a href="tel:+79197194499" class="footer-link">+7 (919) 719-44-99</a></li>
              <li><a href="https://wa.me/79197194499" target="_blank" class="footer-link">WhatsApp</a></li>
              <li><a href="https://t.me/indial_perm" target="_blank" class="footer-link">Telegram</a></li>
              <li><a href="https://www.instagram.com/indial_perm" target="_blank" class="footer-link">Instagram</a></li>
              <li class="footer-link">Ежедневно 10:00–20:00</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom" style="justify-content: flex-end;">
        </div>
      </div>
    `;
  }

  /* Toast utility — exposed globally */
  window.showToast = function (msg, isErr = false) {
    let t = document.getElementById('__toast__');
    if (!t) {
      t = document.createElement('div');
      t.id = '__toast__';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 4000);
  };

  /* Training pricing 3D carousel */
  const initTrainingPricingCarousel = () => {
    const carousel = document.querySelector('.carousel-3d');
    if (!carousel) return;

    const rotateTo = (targetCard) => {
      const currentPos = targetCard.dataset.pos;
      if (currentPos !== 'left' && currentPos !== 'right') return;

      const centerCard = carousel.querySelector('.pricing-card-3d[data-pos="center"]');
      const leftCard = carousel.querySelector('.pricing-card-3d[data-pos="left"]');
      const rightCard = carousel.querySelector('.pricing-card-3d[data-pos="right"]');
      if (!centerCard || !leftCard || !rightCard) return;

      [centerCard, leftCard, rightCard].forEach((card) => {
        card.classList.remove('pos-left', 'pos-center', 'pos-right');
      });

      const nextPositions = currentPos === 'left'
        ? [[leftCard, 'center'], [centerCard, 'right'], [rightCard, 'left']]
        : [[rightCard, 'center'], [centerCard, 'left'], [leftCard, 'right']];

      nextPositions.forEach(([card, pos]) => {
        card.classList.add(`pos-${pos}`);
        card.dataset.pos = pos;
      });
    };

    const rotateByDirection = (direction) => {
      const targetPos = direction === 'prev' ? 'left' : 'right';
      const targetCard = carousel.querySelector(`.pricing-card-3d[data-pos="${targetPos}"]`);
      if (targetCard) rotateTo(targetCard);
    };

    carousel.querySelectorAll('.pricing-card-3d').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (window.matchMedia('(max-width: 968px)').matches) return;
        if (e.target.closest('.btn-primary') && card.dataset.pos === 'center') return;
        if (card.dataset.pos === 'left' || card.dataset.pos === 'right') {
          e.preventDefault();
          rotateTo(card);
        }
      });

      card.addEventListener('keydown', (e) => {
        if (window.matchMedia('(max-width: 968px)').matches) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (card.dataset.pos === 'left' || card.dataset.pos === 'right') {
          e.preventDefault();
          rotateTo(card);
        }
      });
    });

    document.querySelectorAll('.carousel-3d-arrow').forEach((button) => {
      button.addEventListener('click', () => {
        rotateByDirection(button.classList.contains('carousel-3d-arrow--prev') ? 'prev' : 'next');
      });
    });
  };

  initTrainingPricingCarousel();

  /* ==========================================================================
     SCROLL REVEAL ANIMATIONS (IntersectionObserver)
     ========================================================================== */
  const REVEAL_SELECTORS = '.reveal, .reveal-fade, .reveal-scale, .reveal-up, .reveal-left, .reveal-right';

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -50px 0px'
  });

  const observeElements = () => {
    document.querySelectorAll(REVEAL_SELECTORS).forEach((el, i) => {
      // Auto stagger siblings inside grid/strip containers
      const parent = el.parentElement;
      const siblings = parent ? [...parent.querySelectorAll(REVEAL_SELECTORS)] : [];
      const sibIdx = siblings.indexOf(el);
      if (sibIdx > 0 && !el.style.getPropertyValue('--reveal-delay')) {
        el.style.setProperty('--reveal-delay', `${sibIdx * 0.13}s`);
      }
      revealObserver.observe(el);
    });
  };

  // Run on startup
  observeElements();

  // Export so that other pages can trigger observer manually after dynamic rendering
  window.initRevealAnimations = observeElements;

})();
