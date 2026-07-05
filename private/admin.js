document.addEventListener('DOMContentLoaded', () => {
  // State
  let token = localStorage.getItem('adminToken') || '';
  let activeTab = 'services-tab';
  let servicesData = [];
  let galleryData = [];
  let reviewsData = [];
  let applicationsData = [];
  let mastersData = [];

  // DOM Sections
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  
  // Login Form
  const loginForm = document.getElementById('admin-login-form');
  const loginPassword = document.getElementById('admin-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  
  // Navigation & Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const logoutBtn = document.getElementById('logout-btn');
  const currentTabTitle = document.getElementById('current-tab-title');
  const currentTabDesc = document.getElementById('current-tab-desc');
  const appBadge = document.getElementById('app-badge');

  // Services Editor Elements
  const servicesEditorContainer = document.getElementById('services-editor-container');
  const addCategoryBtn = document.getElementById('add-category-btn');
  const saveServicesBtn = document.getElementById('save-services-btn');

  // Gallery Upload Elements
  const galleryUploadForm = document.getElementById('gallery-upload-form');
  const dropzone = document.getElementById('dropzone');
  const photoFile = document.getElementById('photo-file');
  const fileNameLabel = document.getElementById('file-name-label');
  const galleryManagerContainer = document.getElementById('gallery-manager-container');

  // Reviews Elements
  const reviewsManagerContainer = document.getElementById('reviews-manager-container');

  // Applications Elements
  const applicationsManagerContainer = document.getElementById('applications-manager-container');

  // Masters Elements
  const mastersEditorContainer = document.getElementById('masters-editor-container');
  const addMasterBtn = document.getElementById('add-master-btn');
  const saveMastersBtn = document.getElementById('save-masters-btn');

  // Settings Elements
  const passwordChangeForm = document.getElementById('password-change-form');
  const currentAdminPassword = document.getElementById('current-admin-password');
  const newAdminPassword = document.getElementById('new-admin-password');
  const confirmAdminPassword = document.getElementById('confirm-admin-password');

  const MASTER_IMG_FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='260'><rect fill='%23E8E8E8' width='100%' height='100%'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%236B6B6B' font-family='Arial' font-size='14'>Фото</text></svg>";

  function escapeAttr(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getImageSrc(value = '') {
    const src = String(value);
    return src.startsWith('http') || src.startsWith('/') ? src : `/img/${src}`;
  }

  // Toast Notifications
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message-text');
  const toastIcon = document.getElementById('toast-icon-element');

  function showToast(message, isError = false) {
    if (!toast || !toastMsg || !toastIcon) return;
    toastMsg.textContent = message;
    if (isError) {
      toast.classList.add('error');
      toastIcon.innerHTML = '✕';
    } else {
      toast.classList.remove('error');
      toastIcon.innerHTML = '✓';
    }
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 4500);
  }

  // ==========================================
  // AUTHENTICATION FLOW
  // ==========================================
  function checkAuth() {
    if (dashboardSection) {
      // We are on the secure dashboard page, load data
      loadAllDashboardData();
    }
  }

  // Login handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = loginPassword.value;
      
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Ошибка входа');
        }
        
        token = data.token;
        localStorage.setItem('adminToken', token);
        loginPassword.value = '';
        loginErrorMsg.style.display = 'none';
        
        // Reload page to let server detect cookie and serve dashboard HTML
        window.location.reload();
      } catch (err) {
        loginErrorMsg.textContent = err.message;
        loginErrorMsg.style.display = 'block';
      }
    });
  }

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
      } catch (err) {
        console.error(err);
      }
      token = '';
      localStorage.removeItem('adminToken');
      window.location.reload();
    });
  }

  // ==========================================
  // DASHBOARD NAVIGATION (TABS)
  // ==========================================
  if (navItems.length > 0) {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        
        // Update sidebar nav state
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Update screen state
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        const targetContent = document.getElementById(tabId);
        if (targetContent) targetContent.classList.add('active');
        
        activeTab = tabId;
        updateHeaderTitle();
      });
    });
  }

  function updateHeaderTitle() {
    if (!currentTabTitle || !currentTabDesc) return;
    const titles = {
      'services-tab': {
        title: 'Управление услугами',
        desc: 'Добавление, редактирование и удаление услуг в категориях прайс-листа'
      },
      'gallery-tab': {
        title: 'Галерея работ',
        desc: 'Загрузка фотографий выполненных работ на сервер и управление текущей галереей'
      },
      'masters-tab': {
        title: 'Мастера',
        desc: 'Добавление мастеров, редактирование профилей, аватарок и портфолио'
      },
      'settings-tab': {
        title: 'Настройки',
        desc: 'Смена пароля администратора'
      }
    };
    
    if (titles[activeTab]) {
      currentTabTitle.textContent = titles[activeTab].title;
      currentTabDesc.textContent = titles[activeTab].desc;
    }
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async function loadAllDashboardData() {
    try {
      // 1. Fetch public data (services, gallery)
      const publicRes = await fetch('/api/data');
      if (!publicRes.ok) throw new Error('Не удалось загрузить публичные данные.');
      const data = await publicRes.json();
      
      servicesData = data.services || [];
      galleryData = data.gallery || [];
      mastersData = data.masters || [];

      // Render screens
      renderServicesEditor();
      renderGalleryManager();
      renderMastersEditor();
    } catch (err) {
      console.error(err);
      showToast('Ошибка при загрузке данных с сервера.', true);
    }
  }

  function updateApplicationsBadge() {
    if (!appBadge) return;
    const count = applicationsData.length;
    if (count > 0) {
      appBadge.textContent = count;
      appBadge.style.display = 'inline-block';
    } else {
      appBadge.style.display = 'none';
    }
  }

  // ==========================================
  // SERVICES PRICE EDITOR (TAB 1)
  // ==========================================
  function renderServicesEditor() {
    if (!servicesEditorContainer) return;
    servicesEditorContainer.innerHTML = '';
    
    if (servicesData.length === 0) {
      servicesEditorContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Нажмите кнопку "+ Категория", чтобы начать.</p>';
      return;
    }

    servicesData.forEach((cat) => {
      const categoryBlock = document.createElement('div');
      categoryBlock.className = 'admin-category-block';
      categoryBlock.setAttribute('data-id', cat.id);
      
      // Header for category (category title, delete category btn)
      const headerDiv = document.createElement('div');
      headerDiv.className = 'category-block-header';
      headerDiv.innerHTML = `
        <input type="text" class="category-title-input" value="${cat.categoryName}" placeholder="Название категории">
        <button class="btn-danger btn-sm delete-cat-btn" type="button">Удалить категорию</button>
      `;
      
      // Items container
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'category-items-container';
      
      // Render service rows
      const itemsList = cat.items || [];
      itemsList.forEach((item) => {
        const row = createServiceRow(item);
        itemsContainer.appendChild(row);
      });
      
      // Add row button
      const addRowBtn = document.createElement('button');
      addRowBtn.className = 'btn-add-row';
      addRowBtn.type = 'button';
      addRowBtn.innerHTML = '+ Добавить услугу';
      addRowBtn.addEventListener('click', () => {
        const newRow = createServiceRow({ name: '', price: '', duration: '', description: '' });
        itemsContainer.insertBefore(newRow, addRowBtn);
      });
      
      itemsContainer.appendChild(addRowBtn);

      // Delete Category Action
      headerDiv.querySelector('.delete-cat-btn').addEventListener('click', () => {
        if (confirm(`Удалить категорию "${cat.categoryName}" со всеми услугами?`)) {
          categoryBlock.remove();
        }
      });

      categoryBlock.appendChild(headerDiv);
      categoryBlock.appendChild(itemsContainer);
      servicesEditorContainer.appendChild(categoryBlock);
    });
  }

  function createServiceRow(item) {
    const row = document.createElement('div');
    row.className = 'admin-service-row';
    row.innerHTML = `
      <div class="form-group" style="margin-bottom:0">
        <input type="text" class="form-input service-name-field" value="${item.name}" placeholder="Название услуги *" required>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <input type="text" class="form-input service-price-field" value="${item.price}" placeholder="Цена *" required>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <input type="text" class="form-input service-duration-field" value="${item.duration}" placeholder="Длительность (например: 60 мин)" required>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <input type="text" class="form-input service-desc-field" value="${item.description || ''}" placeholder="Описание услуги">
      </div>
      <button class="row-delete-btn" type="button" title="Удалить услугу">✕</button>
    `;
    
    row.querySelector('.row-delete-btn').addEventListener('click', () => {
      row.remove();
    });
    
    return row;
  }

  // Add Category Handler
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      const newCat = {
        id: 'cat-' + Date.now(),
        categoryName: 'Новая категория услуг',
        items: []
      };
      servicesData.push(newCat);
      renderServicesEditor();
      showToast('Категория добавлена. Введите название и добавьте услуги.');
    });
  }

  // Save Services Handler
  if (saveServicesBtn) {
    saveServicesBtn.addEventListener('click', async () => {
      // Read DOM to construct services JSON array
      const categoryBlocks = servicesEditorContainer.querySelectorAll('.admin-category-block');
      const updatedServices = [];
      let isValid = true;
  
      categoryBlocks.forEach(block => {
        const catId = block.getAttribute('data-id');
        const categoryName = block.querySelector('.category-title-input').value.trim();
        
        if (!categoryName) {
          isValid = false;
          block.querySelector('.category-title-input').style.borderColor = 'var(--danger)';
        } else {
          block.querySelector('.category-title-input').style.borderColor = '';
        }
  
        const serviceRows = block.querySelectorAll('.admin-service-row');
        const items = [];
  
        serviceRows.forEach(row => {
          const nameInput = row.querySelector('.service-name-field');
          const priceInput = row.querySelector('.service-price-field');
          const durationInput = row.querySelector('.service-duration-field');
          const descInput = row.querySelector('.service-desc-field');
  
          const name = nameInput.value.trim();
          const price = priceInput.value.trim();
          const duration = durationInput.value.trim();
          const description = descInput.value.trim();
  
          if (!name || !price) {
            isValid = false;
            if (!name) nameInput.style.borderColor = 'var(--danger)';
            if (!price) priceInput.style.borderColor = 'var(--danger)';
          } else {
            nameInput.style.borderColor = '';
            priceInput.style.borderColor = '';
          }
  
          items.push({
            id: 'item-' + Math.round(Math.random() * 1e9),
            name,
            price,
            duration: duration || '60 мин',
            description
          });
        });
  
        updatedServices.push({
          id: catId,
          categoryName,
          items
        });
      });
  
      if (!isValid) {
        showToast('Заполните все обязательные поля (название категории, имя услуги и цена).', true);
        return;
      }
  
      try {
        const res = await fetch('/api/services', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ services: updatedServices })
        });
        const result = await res.json();
        
        if (!res.ok) throw new Error(result.error || 'Ошибка сохранения.');
  
        showToast(result.message);
        servicesData = result.services;
        renderServicesEditor();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // ==========================================
  // GALLERY MANAGEMENT (TAB 2)
  // ==========================================
  // Drag and drop events
  if (dropzone) {
    dropzone.addEventListener('click', () => photoFile.click());
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        photoFile.files = e.dataTransfer.files;
        updateFileNameIndicator();
      }
    });

    photoFile.addEventListener('change', updateFileNameIndicator);
  }

  function updateFileNameIndicator() {
    if (!fileNameLabel || !photoFile) return;
    if (photoFile.files.length > 0) {
      fileNameLabel.textContent = `Выбран файл: ${photoFile.files[0].name}`;
    } else {
      fileNameLabel.textContent = 'Файл не выбран';
    }
  }

  // Upload Form Submit
  if (galleryUploadForm) {
    galleryUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(galleryUploadForm);
      
      try {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Ошибка загрузки фотографии.');
        }
        
        showToast(result.message);
        galleryUploadForm.reset();
        if (fileNameLabel) fileNameLabel.textContent = 'Файл не выбран';
        
        // Reload dashboard data
        loadAllDashboardData();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Render gallery list with delete switches
  function renderGalleryManager() {
    if (!galleryManagerContainer) return;
    galleryManagerContainer.innerHTML = '';
    
    if (galleryData.length === 0) {
      galleryManagerContainer.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-light)">Галерея пуста.</p>';
      return;
    }

    galleryData.forEach(photo => {
      const div = document.createElement('div');
      div.className = 'gallery-manager-item';
      
      const imageSrc = getImageSrc(photo.filename);
      const fallbackSrc = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='130' height='130' viewBox='0 0 130 130'><rect width='100%' height='100%' fill='%23E8E8E8'/><text x='50%' y='50%' font-family='sans-serif' font-size='10' fill='%236B6B6B' text-anchor='middle'>ФОТО РАБОТЫ</text></svg>`;

      div.innerHTML = `
        <img src="${imageSrc}" alt="${photo.description}" onerror="this.onerror=null; this.src='${fallbackSrc}';">
        <div class="gallery-manager-item-overlay">
          <button class="btn-delete-photo" title="Удалить работу" data-id="${photo.id}">✕</button>
        </div>
      `;

      div.querySelector('.btn-delete-photo').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Вы уверены, что хотите удалить эту фотографию из галереи?')) {
          await deletePhoto(photo.id);
        }
      });

      galleryManagerContainer.appendChild(div);
    });
  }

  async function deletePhoto(id) {
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления фотографии.');
      
      showToast(data.message);
      loadAllDashboardData();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ==========================================
  // REVIEWS MANAGEMENT (TAB 3)
  // ==========================================
  function renderReviewsManager() {
    if (!reviewsManagerContainer) return;
    reviewsManagerContainer.innerHTML = '';

    if (reviewsData.length === 0) {
      reviewsManagerContainer.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">Отзывов пока нет.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Дата</th>
          <th>Имя</th>
          <th>Оценка</th>
          <th>Текст</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    reviewsData.forEach(review => {
      const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));
      const textPreview = review.text.length > 120 ? review.text.slice(0, 120) + '…' : review.text;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${review.date || '—'}</td>
        <td>${review.name}</td>
        <td><span class="rating-stars-color">${stars}</span></td>
        <td>${textPreview}</td>
        <td><button class="btn-danger btn-sm" type="button" data-id="${review.id}">Удалить</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => deleteReview(review.id));
      tbody.appendChild(tr);
    });

    reviewsManagerContainer.appendChild(table);
  }

  async function deleteReview(id) {
    if (!confirm('Удалить этот отзыв с сайта?')) return;
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления отзыва.');
      showToast(data.message);
      loadAllDashboardData();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ==========================================
  // APPLICATIONS MANAGEMENT (TAB 4)
  // ==========================================
  function renderApplicationsManager() {
    if (!applicationsManagerContainer) return;
    applicationsManagerContainer.innerHTML = '';

    if (applicationsData.length === 0) {
      applicationsManagerContainer.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">Новых заявок нет.</p>';
      return;
    }

    const sorted = [...applicationsData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Дата</th>
          <th>Тип</th>
          <th>Имя</th>
          <th>Телефон</th>
          <th>Позиция</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    sorted.forEach(app => {
      const dateStr = app.timestamp
        ? new Date(app.timestamp).toLocaleDateString('ru-RU')
        : '—';
      const typeLabel = app.type === 'training' ? 'Обучение' : 'Работа';
      const typeClass = app.type === 'training' ? 'training' : 'career';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><span class="badge-row ${typeClass}">${typeLabel}</span></td>
        <td>${app.candidateName}</td>
        <td><a href="tel:${app.phone}">${app.phone}</a></td>
        <td>${app.position}${app.message ? `<br><small style="color:var(--mid-gray)">${app.message.slice(0, 80)}${app.message.length > 80 ? '…' : ''}</small>` : ''}</td>
        <td><button class="btn-danger btn-sm" type="button" data-id="${app.id}">Удалить</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => deleteApplication(app.id));
      tbody.appendChild(tr);
    });

    applicationsManagerContainer.appendChild(table);
  }

  async function deleteApplication(id) {
    if (!confirm('Удалить эту заявку?')) return;
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления заявки.');
      showToast(data.message);
      loadAllDashboardData();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  // ==========================================
  // MASTERS MANAGEMENT (TAB 5)
  // ==========================================
  function renderMasterPortfolio(block, portfolio) {
    const grid = block.querySelector('.master-portfolio-grid');
    if (!grid) return;
    grid.innerHTML = '';

    (portfolio || []).forEach((url) => {
      const item = document.createElement('div');
      item.className = 'master-portfolio-item';
      item.setAttribute('data-url', url);
      item.innerHTML = `
        <img src="${escapeAttr(url)}" alt="Работа мастера" onerror="this.src='${MASTER_IMG_FALLBACK}'">
        <button class="btn-delete-photo" type="button" title="Удалить из портфолио">✕</button>
      `;
      item.querySelector('.btn-delete-photo').addEventListener('click', () => item.remove());
      grid.appendChild(item);
    });
  }

  function createMasterBlock(master) {
    const block = document.createElement('div');
    block.className = 'admin-master-block';
    block.setAttribute('data-id', master.id);

    block.innerHTML = `
      <div class="master-block-header">
        <div class="master-block-title">${escapeAttr(master.name || 'Новый мастер')}</div>
        <button class="btn-danger btn-sm delete-master-btn" type="button">Удалить мастера</button>
      </div>
      <div class="master-block-grid">
        <div class="master-avatar-panel">
          <img class="master-avatar-preview" src="${escapeAttr(master.avatar || MASTER_IMG_FALLBACK)}" alt="Аватар" onerror="this.src='${MASTER_IMG_FALLBACK}'">
          <input type="file" class="master-avatar-file" accept="image/*">
          <button class="btn-secondary btn-sm master-avatar-upload-btn" type="button">Загрузить аватар</button>
        </div>
        <div class="master-fields">
          <div class="form-group">
            <label class="form-label">Имя *</label>
            <input type="text" class="form-input master-name-field" value="${escapeAttr(master.name || '')}" placeholder="Имя мастера" required>
          </div>
          <div class="form-group">
            <label class="form-label">Должность</label>
            <input type="text" class="form-input master-role-field" value="${escapeAttr(master.role || '')}" placeholder="Например: Топ-колорист">
          </div>
          <div class="form-group">
            <label class="form-label">Специализация</label>
            <textarea class="form-input master-spec-field" rows="3" placeholder="Чем занимается мастер">${escapeAttr(master.specialization || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Опыт</label>
            <textarea class="form-input master-exp-field" rows="3" placeholder="Опыт работы, обучение">${escapeAttr(master.experience || '')}</textarea>
          </div>
          <div class="master-portfolio-section">
            <label class="form-label">Портфолио работ</label>
            <div class="master-portfolio-grid"></div>
            <div class="master-upload-row">
              <input type="file" class="master-portfolio-file" accept="image/*">
              <button class="btn-secondary btn-sm master-portfolio-upload-btn" type="button">Добавить фото</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const nameField = block.querySelector('.master-name-field');
    const titleEl = block.querySelector('.master-block-title');
    nameField.addEventListener('input', () => {
      titleEl.textContent = nameField.value.trim() || 'Новый мастер';
    });

    block.querySelector('.delete-master-btn').addEventListener('click', () => {
      const name = nameField.value.trim() || 'этого мастера';
      if (confirm(`Удалить ${name} из списка?`)) {
        block.remove();
      }
    });

    block.querySelector('.master-avatar-upload-btn').addEventListener('click', async () => {
      const fileInput = block.querySelector('.master-avatar-file');
      if (!fileInput.files.length) {
        showToast('Выберите файл аватара.', true);
        return;
      }
      const url = await uploadMasterImageFile(fileInput.files[0]);
      if (url) {
        block.querySelector('.master-avatar-preview').src = url;
        block.setAttribute('data-avatar', url);
        fileInput.value = '';
        showToast('Аватар загружен.');
      }
    });

    block.querySelector('.master-portfolio-upload-btn').addEventListener('click', async () => {
      const fileInput = block.querySelector('.master-portfolio-file');
      if (!fileInput.files.length) {
        showToast('Выберите фото для портфолио.', true);
        return;
      }
      const url = await uploadMasterImageFile(fileInput.files[0]);
      if (url) {
        const grid = block.querySelector('.master-portfolio-grid');
        const item = document.createElement('div');
        item.className = 'master-portfolio-item';
        item.setAttribute('data-url', url);
        item.innerHTML = `
          <img src="${escapeAttr(url)}" alt="Работа мастера" onerror="this.src='${MASTER_IMG_FALLBACK}'">
          <button class="btn-delete-photo" type="button" title="Удалить из портфолио">✕</button>
        `;
        item.querySelector('.btn-delete-photo').addEventListener('click', () => item.remove());
        grid.appendChild(item);
        fileInput.value = '';
        showToast('Фото добавлено в портфолио.');
      }
    });

    if (master.avatar) {
      block.setAttribute('data-avatar', master.avatar);
    }

    renderMasterPortfolio(block, master.portfolio || []);
    return block;
  }

  function renderMastersEditor() {
    if (!mastersEditorContainer) return;
    mastersEditorContainer.innerHTML = '';

    if (mastersData.length === 0) {
      mastersEditorContainer.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:2rem;">Нажмите «+ Мастер», чтобы добавить первого мастера.</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'masters-editor-list';
    mastersData.forEach((master) => {
      list.appendChild(createMasterBlock(master));
    });
    mastersEditorContainer.appendChild(list);
  }

  async function uploadMasterImageFile(file) {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/masters/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка загрузки изображения.');
      return result.url;
    } catch (err) {
      showToast(err.message, true);
      return null;
    }
  }

  function collectMastersFromDom() {
    const blocks = mastersEditorContainer.querySelectorAll('.admin-master-block');
    const updatedMasters = [];
    let isValid = true;

    blocks.forEach((block) => {
      const nameInput = block.querySelector('.master-name-field');
      const name = nameInput.value.trim();

      if (!name) {
        isValid = false;
        nameInput.style.borderColor = 'var(--danger)';
      } else {
        nameInput.style.borderColor = '';
      }

      const portfolio = [...block.querySelectorAll('.master-portfolio-item')]
        .map((item) => item.getAttribute('data-url'))
        .filter(Boolean);

      let avatar = block.getAttribute('data-avatar') || '';
      if (!avatar) {
        const previewSrc = block.querySelector('.master-avatar-preview').src;
        if (previewSrc && !previewSrc.startsWith('data:')) {
          avatar = previewSrc.replace(window.location.origin, '');
        }
      }

      updatedMasters.push({
        id: block.getAttribute('data-id'),
        name,
        role: block.querySelector('.master-role-field').value.trim(),
        specialization: block.querySelector('.master-spec-field').value.trim(),
        experience: block.querySelector('.master-exp-field').value.trim(),
        avatar,
        portfolio,
      });
    });

    return { updatedMasters, isValid };
  }

  if (addMasterBtn) {
    addMasterBtn.addEventListener('click', () => {
      const newMaster = {
        id: 'master-' + Date.now(),
        name: '',
        role: '',
        specialization: '',
        experience: '',
        avatar: '',
        portfolio: [],
      };

      if (mastersEditorContainer.querySelector('p')) {
        mastersEditorContainer.innerHTML = '';
      }

      let list = mastersEditorContainer.querySelector('.masters-editor-list');
      if (!list) {
        list = document.createElement('div');
        list.className = 'masters-editor-list';
        mastersEditorContainer.appendChild(list);
      }

      list.appendChild(createMasterBlock(newMaster));
      showToast('Мастер добавлен. Заполните данные и сохраните.');
    });
  }

  if (saveMastersBtn) {
    saveMastersBtn.addEventListener('click', async () => {
      const { updatedMasters, isValid } = collectMastersFromDom();

      if (!isValid) {
        showToast('У каждого мастера должно быть указано имя.', true);
        return;
      }

      try {
        const res = await fetch('/api/masters', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ masters: updatedMasters }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка сохранения.');

        showToast(result.message);
        mastersData = result.masters;
        renderMastersEditor();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = currentAdminPassword.value;
      const newPassword = newAdminPassword.value;
      const confirmPassword = confirmAdminPassword.value;

      if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Заполните все поля смены пароля.', true);
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast('Новый пароль и подтверждение не совпадают.', true);
        return;
      }

      if (newPassword.length < 8) {
        showToast('Новый пароль должен быть не короче 8 символов.', true);
        return;
      }

      try {
        const res = await fetch('/api/admin/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка смены пароля.');

        passwordChangeForm.reset();
        showToast(result.message || 'Пароль администратора обновлён.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Run on startup
  checkAuth();
});
