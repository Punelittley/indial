document.addEventListener('DOMContentLoaded', () => {
  // State
  let salonData = { services: [], gallery: [], reviews: [] };
  let activeServiceTab = '';
  let activeGalleryFilter = 'all';

  // DOM Elements
  const header = document.querySelector('.header');
  const burgerToggle = document.getElementById('burger-toggle');
  const navMenu = document.getElementById('nav-menu');
  const servicesTabs = document.getElementById('services-tabs-container');
  const servicesList = document.getElementById('services-list-container');
  const galleryGrid = document.getElementById('gallery-grid-container');
  const reviewsGrid = document.getElementById('reviews-grid-container');
  const addReviewForm = document.getElementById('add-review-form');
  const starsContainer = document.getElementById('stars-rating-container');
  const reviewRatingInput = document.getElementById('review-rating');
  const careersApplyForm = document.getElementById('careers-apply-form');
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  // Lightbox Elements
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption-text');
  const lightboxClose = document.getElementById('lightbox-close-btn');

  // Toast elements
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message-text');
  const toastIcon = document.getElementById('toast-icon-element');

  // ==========================================
  // TOAST NOTIFICATIONS HELPER
  // ==========================================
  const showToast = (message, isError = false) => {
    toastMsg.textContent = message;
    if (isError) {
      toast.classList.add('error');
      toastIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
    } else {
      toast.classList.remove('error');
      toastIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    }
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 4000);
  };

  // ==========================================
  // SCROLL EFFECTS & ANIMATIONS
  // ==========================================
  // Sticky Header on Scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    highlightNavLinkOnScroll();
  });

  // Intersection Observer for scroll animations
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Once element is shown, we can unobserve
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -50px 0px'
  });

  // Observe items
  const reObserveAll = () => {
    document.querySelectorAll('.reveal').forEach(el => {
      revealObserver.observe(el);
    });
  };
  reObserveAll();

  // Active Link Highlighting on Scroll
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');

  const highlightNavLinkOnScroll = () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (window.scrollY >= (sectionTop - 150)) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  };

  // ==========================================
  // MOBILE NAVIGATION
  // ==========================================
  burgerToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    burgerToggle.classList.toggle('active');
    
    // Animate hamburger lines
    const spans = burgerToggle.querySelectorAll('span');
    if (navMenu.classList.contains('active')) {
      spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -6px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });

  // Close menu on link click (mobile)
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      const spans = burgerToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });

  // ==========================================
  // RATING STARS INTERACTION
  // ==========================================
  if (starsContainer) {
    const stars = starsContainer.querySelectorAll('span');
    stars.forEach(star => {
      // Hover effect
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.getAttribute('data-val'));
        stars.forEach(s => {
          const sVal = parseInt(s.getAttribute('data-val'));
          if (sVal <= val) {
            s.innerHTML = '<i class="fa-solid fa-star"></i>';
            s.classList.add('selected');
          } else {
            s.innerHTML = '<i class="fa-regular fa-star"></i>';
            s.classList.remove('selected');
          }
        });
      });

      // Click select
      star.addEventListener('click', () => {
        const val = parseInt(star.getAttribute('data-val'));
        reviewRatingInput.value = val;
        stars.forEach(s => {
          const sVal = parseInt(s.getAttribute('data-val'));
          if (sVal <= val) {
            s.innerHTML = '<i class="fa-solid fa-star"></i>';
            s.classList.add('selected');
          } else {
            s.innerHTML = '<i class="fa-regular fa-star"></i>';
            s.classList.remove('selected');
          }
        });
      });
    });

    // Reset to current selection value on mouse leave
    starsContainer.addEventListener('mouseleave', () => {
      const currentVal = parseInt(reviewRatingInput.value);
      stars.forEach(s => {
        const sVal = parseInt(s.getAttribute('data-val'));
        if (sVal <= currentVal) {
          s.innerHTML = '<i class="fa-solid fa-star"></i>';
          s.classList.add('selected');
        } else {
          s.innerHTML = '<i class="fa-regular fa-star"></i>';
          s.classList.remove('selected');
        }
      });
    });
  }

  // ==========================================
  // BACKEND INTEGRATION & DATA FETCHING
  // ==========================================
  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Не удалось загрузить данные салона.');
      
      salonData = await res.json();
      
      renderServices();
      renderGallery();
      renderReviews();
      
      // Re-observe dynamic entries
      setTimeout(reObserveAll, 100);
    } catch (error) {
      console.error(error);
      showToast('Ошибка при загрузке информации с сервера.', true);
    }
  };

  // ==========================================
  // RENDER SERVICES (PRICES)
  // ==========================================
  const renderServices = () => {
    if (!servicesTabs || !servicesList) return;
    servicesTabs.innerHTML = '';
    
    const categories = salonData.services || [];
    if (categories.length === 0) {
      servicesList.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--text-light)">Прайс-лист временно пуст.</div>';
      return;
    }

    // Set first category active by default if not set
    if (!activeServiceTab && categories.length > 0) {
      activeServiceTab = categories[0].id;
    }

    // Render tab buttons
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${cat.id === activeServiceTab ? 'active' : ''}`;
      btn.textContent = cat.categoryName;
      btn.setAttribute('data-id', cat.id);
      
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeServiceTab = cat.id;
        renderServiceItems();
      });
      
      servicesTabs.appendChild(btn);
    });

    renderServiceItems();
  };

  const renderServiceItems = () => {
    servicesList.innerHTML = '';
    const category = salonData.services.find(cat => cat.id === activeServiceTab);
    
    if (!category || !category.items || category.items.length === 0) {
      servicesList.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--text-light)">Нет доступных услуг в этой категории.</div>';
      return;
    }

    category.items.forEach((item, index) => {
      const itemHTML = `
        <div class="service-item reveal delay-${(index % 3) + 1}">
          <div>
            <div class="service-header-row">
              <h3 class="service-name">${item.name}</h3>
              <span class="service-price">${parseFloat(item.price).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="service-meta">
              <span><i class="fa-regular fa-clock"></i> ${item.duration}</span>
            </div>
            <p class="service-desc">${item.description || ''}</p>
          </div>
        </div>
      `;
      servicesList.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    // Trigger observer update on new items
    reObserveAll();
  };

  // ==========================================
  // RENDER GALLERY
  // ==========================================
  const renderGallery = () => {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    const items = salonData.gallery || [];
    const filteredItems = activeGalleryFilter === 'all' 
      ? items 
      : items.filter(item => item.category === activeGalleryFilter);

    if (filteredItems.length === 0) {
      galleryGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-light); padding: 3rem 0;">В этой категории пока нет работ.</div>';
      return;
    }

    filteredItems.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `gallery-item reveal delay-${(index % 3) + 1}`;
      
      // Fallback clean svg design if image fails to load
      const imageSrc = `/img/${item.filename}`;
      const fallbackSrc = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='100%' height='100%' fill='%23EBE6E4'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='%237A5C58' text-anchor='middle'>INDIAL BEAUTY WORK</text></svg>`;

      div.innerHTML = `
        <img src="${imageSrc}" alt="${item.description}" onerror="this.onerror=null; this.src='${fallbackSrc}';">
        <div class="gallery-overlay">
          <span class="gallery-category">${getCategoryLabel(item.category)}</span>
          <p class="gallery-desc">${item.description}</p>
        </div>
      `;

      // Lightbox click trigger
      div.addEventListener('click', () => {
        openLightbox(imageSrc, item.description, fallbackSrc);
      });

      galleryGrid.appendChild(div);
    });
    
    reObserveAll();
  };

  const getCategoryLabel = (cat) => {
    const labels = {
      hair: 'Волосы / Стрижка / Окрашивание',
      nails: 'Ногтевой сервис',
      makeup: 'Макияж и брови'
    };
    return labels[cat] || cat;
  };

  // Filter Buttons Action
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeGalleryFilter = btn.getAttribute('data-filter');
      renderGallery();
    });
  });

  // Lightbox logic
  const openLightbox = (src, desc, fallback) => {
    lightboxImg.src = src;
    lightboxImg.onerror = () => {
      lightboxImg.src = fallback;
    };
    lightboxCaption.textContent = desc;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scroll
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto'; // Unlock background scroll
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });
  }

  // ==========================================
  // RENDER REVIEWS
  // ==========================================
  const renderReviews = () => {
    if (!reviewsGrid) return;
    reviewsGrid.innerHTML = '';
    
    const list = salonData.reviews || [];
    if (list.length === 0) {
      reviewsGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-light)">Пока нет отзывов. Будьте первым!</div>';
      return;
    }

    // Limit to latest 3 reviews on client home page
    const recentReviews = list.slice(0, 3);

    recentReviews.forEach((rev, index) => {
      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= rev.rating) {
          starsHTML += '<i class="fa-solid fa-star"></i>';
        } else {
          starsHTML += '<i class="fa-regular fa-star"></i>';
        }
      }

      const card = `
        <div class="review-card reveal delay-${index + 1}">
          <div class="review-stars">
            ${starsHTML}
          </div>
          <p class="review-text">${rev.text}</p>
          <div class="review-author">
            <span class="author-name">${rev.name}</span>
            <span class="review-date">${formatDate(rev.date)}</span>
          </div>
        </div>
      `;
      reviewsGrid.insertAdjacentHTML('beforeend', card);
    });
    
    reObserveAll();
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // ==========================================
  // FORM SUBMISSION (ADD REVIEW)
  // ==========================================
  if (addReviewForm) {
    addReviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('review-name').value;
      const rating = reviewRatingInput.value;
      const text = document.getElementById('review-text').value;

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, rating, text })
        });

        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Ошибка при сохранении отзыва.');
        }

        showToast(result.message);
        addReviewForm.reset();
        
        // Reset stars to 5 selection
        reviewRatingInput.value = 5;
        if (starsContainer) {
          const stars = starsContainer.querySelectorAll('span');
          stars.forEach(s => {
            s.innerHTML = '<i class="fa-solid fa-star"></i>';
            s.classList.add('selected');
          });
        }

        // Reload data
        fetchData();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // ==========================================
  // FORM SUBMISSION (CAREERS / TRAINING)
  // ==========================================
  if (careersApplyForm) {
    careersApplyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const candidateName = document.getElementById('apply-name').value;
      const phone = document.getElementById('apply-phone').value;
      const email = document.getElementById('apply-email').value;
      const type = document.getElementById('apply-type').value;
      const position = document.getElementById('apply-position').value;
      const message = document.getElementById('apply-message').value;

      try {
        const res = await fetch('/api/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ candidateName, phone, email, type, position, message })
        });

        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Ошибка отправки заявки.');
        }

        showToast(result.message);
        careersApplyForm.reset();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Start initialization
  fetchData();
});
