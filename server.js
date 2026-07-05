const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin Configuration via Environment Variables (fallback to hardcoded values for local run)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'indialadmin2026';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'indial-secret-session-token-2026';

const PASSWORD_HASH_PREFIX = 'pbkdf2';
const PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_HASH_KEYLEN = 64;
const PASSWORD_HASH_DIGEST = 'sha512';

const hashAdminPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEYLEN, PASSWORD_HASH_DIGEST)
    .toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
};

const getStoredAdminPassword = (data = {}) => (
  data.adminPasswordHash || data.adminPassword || ADMIN_PASSWORD
);

const verifyAdminPassword = (password, storedPassword) => {
  if (typeof password !== 'string') return false;
  if (!storedPassword || typeof storedPassword !== 'string') {
    return password === ADMIN_PASSWORD;
  }

  if (!storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    return password === storedPassword;
  }

  try {
    const [, iterationsRaw, salt, expectedHash] = storedPassword.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !expectedHash) return false;

    const actualHash = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      PASSWORD_HASH_KEYLEN,
      PASSWORD_HASH_DIGEST
    );
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (expectedBuffer.length !== actualHash.length) return false;
    return crypto.timingSafeEqual(actualHash, expectedBuffer);
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return false;
  }
};

// Paths
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'img');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Security & DDoS Protection Middlewares
// -------------------------------------------------------------

// Helmet helps secure the Express app by setting various HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "https://yandex.ru", "https://*.yandex.ru"],
      },
    },
  })
);

// Enable CORS
app.use(cors());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter (DDoS protection)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: 'Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// -------------------------------------------------------------
// Multer Configuration (File Uploads)
// -------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique name keeping the original extension
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

// File filter for security (Images only)
const imageFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Разрешены только изображения (jpeg, jpg, png, webp, gif)!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit size to 5MB
  fileFilter: imageFilter,
});

const masterUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `master-${uniqueSuffix}${ext}`);
  },
});

const uploadMasterImage = multer({
  storage: masterUploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const deleteUploadedMasterFile = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return;
  const filename = path.basename(imagePath);
  if (!filename.startsWith('master-')) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting master image file:', err);
    }
  }
};

const deleteMasterAssetFiles = (master) => {
  if (!master) return;
  deleteUploadedMasterFile(master.avatar);
  (master.portfolio || []).forEach(deleteUploadedMasterFile);
};

// -------------------------------------------------------------
// Input Sanitization (XSS Protection)
// -------------------------------------------------------------
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// -------------------------------------------------------------
// Database Helpers & Adapters (Local JSON file / Vercel KV)
// -------------------------------------------------------------
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

if (useKV) {
  console.log('=== Database Adapter: Using Vercel KV Storage ===');
} else {
  console.log('=== Database Adapter: Using Local data.json File ===');
}

const readData = async () => {
  if (useKV) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/indial_data`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
      });
      const body = await res.json();
      if (body && body.result) {
        return typeof body.result === 'string' ? JSON.parse(body.result) : body.result;
      }
    } catch (error) {
      console.error('Error reading from Vercel KV:', error);
    }
  }

  // Fallback to local file
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading database file, returning defaults:', error);
    return { services: [], gallery: [], reviews: [], masters: [], applications: [] };
  }
};

const writeData = async (data) => {
  if (useKV) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/set/indial_data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(data)) // Value stored in Upstash should be a serialized string
      });
      const body = await res.json();
      if (body && body.result === 'OK') return true;
    } catch (error) {
      console.error('Error writing to Vercel KV:', error);
      return false;
    }
  }

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to database file:', error);
    return false;
  }
};

// Helper to extract adminToken from request cookies
const getAdminTokenFromCookie = (req) => {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('adminToken='));
  return match ? match.split('=')[1] : null;
};

// -------------------------------------------------------------
// Authentication Middleware
// -------------------------------------------------------------
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const tokenFromCookie = getAdminTokenFromCookie(req);

  if ((tokenFromHeader && tokenFromHeader === ADMIN_TOKEN) || (tokenFromCookie && tokenFromCookie === ADMIN_TOKEN)) {
    return next();
  }
  return res.status(401).json({ error: 'Не авторизован. Необходим токен администратора.' });
};

// -------------------------------------------------------------
// Secure Admin Page Routing (Dynamic file serving)
// -------------------------------------------------------------
// Secret Entrance URL
app.get('/indial-entrance', (req, res) => {
  const token = getAdminTokenFromCookie(req);
  if (token === ADMIN_TOKEN) {
    res.redirect('/admin.html');
  } else {
    res.sendFile(path.join(__dirname, 'private', 'login.html'));
  }
});

app.get('/admin.html', (req, res) => {
  const token = getAdminTokenFromCookie(req);
  if (token === ADMIN_TOKEN) {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
  } else {
    // Return 404 instead of login page, to make it completely invisible
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.get('/admin', (req, res) => {
  const token = getAdminTokenFromCookie(req);
  if (token === ADMIN_TOKEN) {
    res.redirect('/admin.html');
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Secure assets serving (admin assets are not in public folder to prevent devtools exposure)
app.get('/css/admin.css', (req, res) => {
  const token = getAdminTokenFromCookie(req);
  if (token === ADMIN_TOKEN) {
    res.sendFile(path.join(__dirname, 'private', 'admin.css'));
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.get('/js/admin.js', (req, res) => {
  const token = getAdminTokenFromCookie(req);
  if (token === ADMIN_TOKEN) {
    res.sendFile(path.join(__dirname, 'private', 'admin.js'));
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// 1. Fetch all public data
app.get('/api/data', async (req, res) => {
  const data = await readData();
  const publicData = {
    services: data.services || [],
    gallery: data.gallery || [],
    reviews: data.reviews || [],
    masters: data.masters || [],
  };
  res.json(publicData);
});

// 2. Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const data = await readData();
  const storedPassword = getStoredAdminPassword(data);

  if (verifyAdminPassword(password, storedPassword)) {
    // Set secure cookie
    res.setHeader('Set-Cookie', `adminToken=${ADMIN_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ token: ADMIN_TOKEN });
  } else {
    res.status(400).json({ error: 'Неверный пароль администратора' });
  }
});

// 2b. Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'adminToken=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ message: 'Вы успешно вышли из системы.' });
});

// 2c. Admin: Change password
app.put('/api/admin/password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const passwordValues = [currentPassword, newPassword, confirmPassword];
  if (passwordValues.some(value => typeof value !== 'string' || !value)) {
    return res.status(400).json({ error: 'Заполните все поля смены пароля.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Новый пароль и подтверждение не совпадают.' });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Новый пароль должен быть не короче 8 символов.' });
  }

  const data = await readData();
  const storedPassword = getStoredAdminPassword(data);

  if (!verifyAdminPassword(currentPassword, storedPassword)) {
    return res.status(403).json({ error: 'Текущий пароль указан неверно.' });
  }

  data.adminPasswordHash = hashAdminPassword(newPassword);
  delete data.adminPassword;

  if (await writeData(data)) {
    return res.json({ message: 'Пароль администратора обновлён.' });
  }

  return res.status(500).json({ error: 'Не удалось сохранить новый пароль.' });
});


// 3. Admin: Update Services (Price list)
app.put('/api/services', requireAdmin, async (req, res) => {
  const { services } = req.body;
  if (!Array.isArray(services)) {
    return res.status(400).json({ error: 'Неверный формат данных цен.' });
  }
  
  const data = await readData();
  data.services = services;
  
  if (await writeData(data)) {
    res.json({ message: 'Прайс-лист успешно обновлен!', services });
  } else {
    res.status(500).json({ error: 'Ошибка сохранения данных.' });
  }
});

// 4. Admin: Upload Photo to Gallery
app.post('/api/gallery', requireAdmin, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Пожалуйста, выберите файл для загрузки.' });
    }
    
    const { category, description } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Укажите категорию работы.' });
    }
    
    const data = await readData();
    const newPhoto = {
      id: 'gal-' + Date.now(),
      filename: req.file.filename,
      category: sanitizeInput(category),
      description: sanitizeInput(description) || '',
      timestamp: Date.now(),
    };
    
    data.gallery = data.gallery || [];
    data.gallery.unshift(newPhoto);
    
    if (await writeData(data)) {
      res.json({ message: 'Фото успешно загружено в галерею!', photo: newPhoto });
    } else {
      res.status(500).json({ error: 'Ошибка сохранения в базу данных.' });
    }
  });
});

// 5. Admin: Delete Photo from Gallery
app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const data = await readData();
  const index = data.gallery.findIndex(item => item.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Фотография не найдена.' });
  }
  
  const photo = data.gallery[index];
  const filePath = path.join(UPLOAD_DIR, photo.filename);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting photo file:', err);
    }
  }
  
  data.gallery.splice(index, 1);
  if (await writeData(data)) {
    res.json({ message: 'Фото успешно удалено!' });
  } else {
    res.status(500).json({ error: 'Ошибка обновления базы данных.' });
  }
});

// 6. Submit Review (Public)
app.post('/api/reviews', async (req, res) => {
  const { name, text, rating } = req.body;
  if (!name || !text || !rating) {
    return res.status(400).json({ error: 'Заполните все обязательные поля отзыва.' });
  }
  
  const numericRating = parseInt(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5 звезд.' });
  }
  
  const data = await readData();
  const newReview = {
    id: 'rev-' + Date.now(),
    name: sanitizeInput(String(name).trim()),
    text: sanitizeInput(String(text).trim()),
    rating: numericRating,
    date: new Date().toISOString().split('T')[0],
  };
  
  data.reviews = data.reviews || [];
  data.reviews.unshift(newReview);
  
  if (await writeData(data)) {
    res.json({ message: 'Спасибо за отзыв! Он добавлен на сайт.', review: newReview });
  } else {
    res.status(500).json({ error: 'Ошибка отправки отзыва.' });
  }
});

// 7. Admin: Delete Review
app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const data = await readData();
  const index = data.reviews.findIndex(item => item.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Отзыв не найден.' });
  }
  
  data.reviews.splice(index, 1);
  if (await writeData(data)) {
    res.json({ message: 'Отзыв удален.' });
  } else {
    res.status(500).json({ error: 'Ошибка обновления базы данных.' });
  }
});

// 8. Submit Application for Job/Training (Public)
app.post('/api/apply', async (req, res) => {
  const { candidateName, phone, email, type, position, message } = req.body;
  if (!candidateName || !phone || !type || !position) {
    return res.status(400).json({ error: 'Заполните все обязательные поля заявки.' });
  }
  
  const data = await readData();
  const newApp = {
    id: 'app-' + Date.now(),
    candidateName: sanitizeInput(String(candidateName).trim()),
    phone: sanitizeInput(String(phone).trim()),
    email: email ? sanitizeInput(String(email).trim()) : '',
    type: String(type) === 'training' ? 'training' : 'career',
    position: sanitizeInput(String(position).trim()),
    message: message ? sanitizeInput(String(message).trim()) : '',
    timestamp: Date.now(),
  };
  
  data.applications = data.applications || [];
  data.applications.push(newApp);
  
  if (await writeData(data)) {
    res.json({ message: 'Ваша заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.' });
  } else {
    res.status(500).json({ error: 'Ошибка отправки заявки.' });
  }
});

// 9. Admin: View all Job/Training Applications
app.get('/api/admin/applications', requireAdmin, async (req, res) => {
  const data = await readData();
  res.json(data.applications || []);
});

// 10. Admin: Delete Application
app.delete('/api/admin/applications/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const data = await readData();
  const index = data.applications.findIndex(item => item.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Заявка не найдена.' });
  }
  
  data.applications.splice(index, 1);
  if (await writeData(data)) {
    res.json({ message: 'Заявка удалена.' });
  } else {
    res.status(500).json({ error: 'Ошибка обновления базы данных.' });
  }
});

// 11. Admin: Upload master image (avatar or portfolio)
app.post('/api/masters/upload', requireAdmin, (req, res) => {
  uploadMasterImage.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Пожалуйста, выберите изображение.' });
    }
    res.json({
      message: 'Изображение загружено.',
      url: `/img/${req.file.filename}`,
    });
  });
});

// 12. Admin: Update masters list
app.put('/api/masters', requireAdmin, async (req, res) => {
  const { masters } = req.body;
  if (!Array.isArray(masters)) {
    return res.status(400).json({ error: 'Неверный формат данных мастеров.' });
  }

  const sanitizePath = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/img/') || trimmed.startsWith('img/')) {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
    return '';
  };

  const sanitizedMasters = masters.map((master, index) => {
    const name = sanitizeInput(String(master.name || '').trim());
    if (!name) {
      return null;
    }
    return {
      id: String(master.id || `master-${Date.now()}-${index}`),
      name,
      role: sanitizeInput(String(master.role || '').trim()),
      specialization: sanitizeInput(String(master.specialization || '').trim()),
      experience: sanitizeInput(String(master.experience || '').trim()),
      avatar: sanitizePath(master.avatar),
      portfolio: Array.isArray(master.portfolio)
        ? master.portfolio.map(sanitizePath).filter(Boolean)
        : [],
    };
  }).filter(Boolean);

  if (sanitizedMasters.length !== masters.length) {
    return res.status(400).json({ error: 'У каждого мастера должно быть указано имя.' });
  }

  const data = await readData();
  const oldMasters = data.masters || [];
  const newIds = new Set(sanitizedMasters.map((m) => m.id));

  oldMasters
    .filter((m) => !newIds.has(m.id))
    .forEach(deleteMasterAssetFiles);

  sanitizedMasters.forEach((newMaster) => {
    const oldMaster = oldMasters.find((m) => m.id === newMaster.id);
    if (!oldMaster) return;

    if (oldMaster.avatar && oldMaster.avatar !== newMaster.avatar) {
      deleteUploadedMasterFile(oldMaster.avatar);
    }

    (oldMaster.portfolio || []).forEach((url) => {
      if (!(newMaster.portfolio || []).includes(url)) {
        deleteUploadedMasterFile(url);
      }
    });
  });

  data.masters = sanitizedMasters;

  if (await writeData(data)) {
    res.json({ message: 'Список мастеров успешно обновлён!', masters: sanitizedMasters });
  } else {
    res.status(500).json({ error: 'Ошибка сохранения данных.' });
  }
});

// -------------------------------------------------------------
// Serve Static Frontend Files
// -------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
}));

// 404 handler — don't redirect API misses to index.html
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=== INDIAL Salon Server is running on http://localhost:${PORT} ===`);
});
