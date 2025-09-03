const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 🚨 AGREGAR ESTO PARA DEBUG
console.log('�� Iniciando servidor...');
console.log('📁 Directorio actual:', __dirname);
console.log('📦 Archivos en el directorio:', fs.readdirSync(__dirname));

try {
  const database = require('./src/utils/database');
  console.log('✅ Módulos importados correctamente');
} catch (error) {
  console.error('❌ Error importando módulos:', error);
  process.exit(1);
}

const app = express();
console.log('✅ Express app creada');

// ⚠️ IMPORTANTE: Para hosting compartido NO usar puerto personalizado
// const PORT = process.env.PORT || 3000; // ❌ NO USAR

// Middleware
app.use(cors());
app.use(express.json());
console.log('✅ Middleware configurado');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'promotion-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: function (req, file, cb) {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

console.log('✅ Multer configurado');

// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta para probar la conexión a la base de datos
app.get('/api/test-connection', async (req, res) => {
  console.log('🔍 Petición GET /api/test-connection');
  try {
    const isConnected = await testConnection();
    console.log('✅ Conexión BD exitosa:', isConnected);
    res.json({ connected: isConnected });
  } catch (error) {
    console.error('❌ Error en test-connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta para autenticar usuario
app.post('/api/login', async (req, res) => {
  console.log('�� Petición POST /api/login');
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email y contraseña son requeridos' 
    });
  }

  try {
    const result = await authenticateUser(email, password);
    console.log('✅ Login exitoso para:', email);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para registrar usuario
app.post('/api/register', async (req, res) => {
  console.log('�� Petición POST /api/register');
  const { nombres, apellidos, cedula, fecha_nacimiento, telefono, email, password } = req.body;
  
  if (!nombres || !apellidos || !cedula || !fecha_nacimiento || !telefono || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Todos los campos son requeridos' 
    });
  }

  try {
    const result = await registerUser(nombres, apellidos, cedula, fecha_nacimiento, telefono, email, password);
    console.log('✅ Usuario registrado:', email);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener el perfil del usuario
app.get('/api/profile/:userId', async (req, res) => {
  console.log('👤 Petición GET /api/profile/:userId');
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await getUserProfile(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para actualizar el perfil del usuario
app.put('/api/profile/:userId', async (req, res) => {
  console.log('✏️ Petición PUT /api/profile/:userId');
  const { userId } = req.params;
  const profileData = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await updateUserProfile(userId, profileData);
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para asignar pandita y saldo fidelizado (admin)
app.post('/api/admin/assign-reward', async (req, res) => {
  console.log('�� Petición POST /api/admin/assign-reward');
  const { userId, assignedBy, purchaseAmount } = req.body;
  
  if (!userId || !assignedBy || !purchaseAmount) {
    return res.status(400).json({ 
      success: false, 
      message: 'Todos los campos son requeridos' 
    });
  }

  try {
    const result = await assignReward(userId, assignedBy, purchaseAmount);
    res.json(result);
  } catch (error) {
    console.error('❌ Error asignando recompensa:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para asignar SOLO pandita (admin)
app.post('/api/admin/assign-pandita', async (req, res) => {
  console.log('�� Petición POST /api/admin/assign-pandita');
  const { userId, assignedBy } = req.body;

  if (!userId || !assignedBy) {
    return res.status(400).json({
      success: false,
      message: 'ID de usuario y asignador son requeridos'
    });
  }

  try {
    const result = await assignPandita(userId, assignedBy);
    res.json(result);
  } catch (error) {
    console.error('❌ Error asignando pandita:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Ruta para asignar SOLO saldo fidelizado (admin)
app.post('/api/admin/assign-loyalty-balance', async (req, res) => {
  console.log('�� Petición POST /api/admin/assign-loyalty-balance');
  const { userId, assignedBy, loyaltyAmount, purchaseAmount } = req.body;

  // Permitir compatibilidad: si viene purchaseAmount, usarlo como loyaltyAmount
  const amountToAssign = typeof loyaltyAmount === 'number' ? loyaltyAmount : purchaseAmount;

  if (!userId || !assignedBy || amountToAssign === undefined) {
    return res.status(400).json({
      success: false,
      message: 'ID de usuario, asignador y monto son requeridos'
    });
  }

  try {
    const result = await assignSaldoFidelizado(userId, assignedBy, amountToAssign);
    res.json(result);
  } catch (error) {
    console.error('❌ Error asignando saldo fidelizado:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Ruta para obtener estadísticas del admin
app.get('/api/admin/stats/:adminId', async (req, res) => {
  console.log('📊 Petición GET /api/admin/stats/:adminId');
  const { adminId } = req.params;
  
  if (!adminId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de admin es requerido' 
    });
  }

  try {
    const result = await getAdminStats(adminId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener recompensas de un usuario
app.get('/api/user/rewards/:userId', async (req, res) => {
  console.log('🎁 Petición GET /api/user/rewards/:userId');
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await getUserRewards(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo recompensas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para actualizar perfil del admin (correo y/o contraseña)
app.put('/api/admin/update-profile', async (req, res) => {
  console.log('👨‍💼 Petición PUT /api/admin/update-profile');
  const { email, currentPassword, newPassword, newEmail } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'El correo actual es requerido' 
    });
  }

  try {
    const result = await updateAdminProfile(email, currentPassword, newPassword, newEmail);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en /api/admin/update-profile:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Ruta para obtener información del usuario por ID
app.get('/api/user/:userId', async (req, res) => {
  console.log('👤 Petición GET /api/user/:userId');
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await getUserById(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener el saldo fidelizado del usuario
app.get('/api/user/loyalty-balance/:userId', async (req, res) => {
  console.log('💰 Petición GET /api/user/loyalty-balance/:userId');
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await getLoyaltyBalance(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo saldo fidelizado:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rutas de promociones

// Ruta para subir imagen
app.post('/api/admin/upload-image', upload.single('image'), async (req, res) => {
  console.log('�� Petición POST /api/admin/upload-image');
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se subió ningún archivo' 
      });
    }

    // Generar URL para acceder a la imagen
    const imageUrl = `https://38.46.223.180/uploads/${req.file.filename}`;
    
    console.log('📸 Imagen subida:', req.file.filename);
    console.log('🔗 URL generada:', imageUrl);

    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      filename: req.file.filename,
      message: 'Imagen subida correctamente' 
    });
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al subir la imagen' 
    });
  }
});

// Ruta para crear una nueva promoción (admin)
app.post('/api/admin/promotions', async (req, res) => {
  console.log('�� Petición POST /api/admin/promotions');
  const { title, description, imageUrl, promotionType, createdBy } = req.body;
  
  if (!title || !createdBy || !promotionType) {
    return res.status(400).json({ 
      success: false, 
      message: 'Título, tipo de promoción y creador son requeridos' 
    });
  }

  try {
    const result = await createPromotion(title, description || '', imageUrl || '', promotionType, createdBy);
    res.json(result);
  } catch (error) {
    console.error('❌ Error creando promoción:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener todas las promociones
app.get('/api/promotions', async (req, res) => {
  console.log('📨 Petición recibida en /api/promotions');
  try {
    const result = await getPromotions();
    console.log('📤 Promociones enviadas:', result.promotions);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo promociones:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener la promoción del mes
app.get('/api/promo-del-mes', async (req, res) => {
  console.log('🌟 Petición recibida en /api/promo-del-mes');
  try {
    const result = await getPromoDelMes();
    console.log('📤 Promoción del mes enviada:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo promoción del mes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener promociones por tipo
app.get('/api/promotions/:type', async (req, res) => {
  const { type } = req.params;
  console.log(`📨 Petición recibida en /api/promotions/${type}`);
  
  if (!['regular', 'promo_del_mes', 'notifications'].includes(type)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Tipo de promoción inválido' 
    });
  }
  
  try {
    const result = await getPromotionsByType(type);
    console.log(`📤 Promociones de tipo ${type} enviadas:`, result.promotions);
    res.json(result);
  } catch (error) {
    console.error(`❌ Error obteniendo promociones de tipo ${type}:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para eliminar una promoción (admin)
app.delete('/api/admin/promotions/:promotionId', async (req, res) => {
  console.log('🗑️ Petición DELETE recibida para promoción ID:', req.params.promotionId);
  
  const { promotionId } = req.params;
  
  if (!promotionId) {
    console.log('❌ ID de promoción faltante');
    return res.status(400).json({ 
      success: false, 
      message: 'ID de promoción es requerido' 
    });
  }

  try {
    console.log('🔄 Llamando a deletePromotion con ID:', promotionId);
    const result = await deletePromotion(promotionId);
    console.log('📤 Resultado de eliminación:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error eliminando promoción:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para limpiar archivos huérfanos (admin)
app.post('/api/admin/cleanup-files', async (req, res) => {
  console.log('�� Iniciando limpieza de archivos huérfanos...');
  try {
    const result = await cleanupOrphanedFiles();
    res.json(result);
  } catch (error) {
    console.error('❌ Error limpiando archivos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rutas para pandas de líder

// Ruta para asignar panda de líder (admin)
app.post('/api/admin/assign-leader-panda', async (req, res) => {
  console.log('🏆 Petición para asignar panda de líder recibida');
  const { userId, assignedBy } = req.body;
  
  if (!userId || !assignedBy) {
    console.log('❌ Datos faltantes para asignar panda de líder');
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario y asignador son requeridos' 
    });
  }

  try {
    console.log('�� Asignando panda de líder para usuario:', userId, 'por admin:', assignedBy);
    const result = await assignLeaderPanda(userId, assignedBy);
    console.log('�� Resultado de asignación de panda de líder:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error asignando panda de líder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener pandas de líder de un usuario
app.get('/api/user/leader-pandas/:userId', async (req, res) => {
  console.log('🏆 Petición para obtener pandas de líder del usuario:', req.params.userId);
  const { userId } = req.params;
  
  if (!userId) {
    console.log('❌ ID de usuario faltante');
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario es requerido' 
    });
  }

  try {
    const result = await getUserLeaderPandas(userId);
    console.log('📤 Pandas de líder enviados:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo pandas de líder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para quitar pandas de líder activos de un usuario (admin)
app.post('/api/admin/remove-leader-pandas', async (req, res) => {
  console.log('🗑️ Petición para quitar pandas de líder');
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'ID de usuario es requerido' });
  }
  try {
    const result = await removeLeaderPandas(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en /api/admin/remove-leader-pandas:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Rutas para textos configurables

// Ruta para obtener texto configurable
app.get('/api/config/text/:keyName', async (req, res) => {
  console.log('📝 Petición para obtener texto configurable:', req.params.keyName);
  const { keyName } = req.params;
  
  if (!keyName) {
    console.log('❌ Nombre de clave faltante');
    return res.status(400).json({ 
      success: false, 
      message: 'Nombre de clave es requerido' 
    });
  }

  try {
    const result = await getConfigText(keyName);
    console.log('�� Texto configurable enviado:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo texto configurable:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para actualizar texto configurable (admin)
app.put('/api/admin/config/text/:keyName', async (req, res) => {
  console.log('📝 Petición para actualizar texto configurable:', req.params.keyName);
  const { keyName } = req.params;
  const { newText } = req.body;
  
  if (!keyName || !newText) {
    console.log('❌ Datos faltantes para actualizar texto');
    return res.status(400).json({ 
      success: false, 
      message: 'Nombre de clave y nuevo texto son requeridos' 
    });
  }

  try {
    const result = await updateConfigText(keyName, newText);
    console.log('📤 Resultado de actualización de texto:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error actualizando texto configurable:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta específica para obtener términos del programa líder
app.get('/api/config-texts/leader-terms', async (req, res) => {
  console.log('🏆 Petición para obtener términos del programa líder');
  
  try {
    const result = await getConfigText('leader_terms');
    console.log('📤 Términos del programa líder enviados:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo términos del líder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener todos los usuarios (admin)
app.get('/api/users', async (req, res) => {
  console.log('👥 Petición para obtener lista de usuarios');
  
  try {
    const { pool } = require('./src/utils/database');
    const [rows] = await pool.execute(
      'SELECT id, nombres, apellidos, cedula, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    console.log('📤 Usuarios encontrados:', rows.length);
    res.json({ 
      success: true, 
      users: rows 
    });
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

console.log('✅ Todas las rutas configuradas');

// ⚠️ IMPORTANTE: Para hosting compartido, NO usar app.listen()
// El hosting (Phusion Passenger) se encargará de iniciar la app

// 🚨 AGREGAR ESTO PARA RENDER
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de desarrollo corriendo en puerto ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
  });
} else {
  // �� PARA PRODUCCIÓN EN RENDER
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de producción corriendo en puerto ${PORT}`);
    console.log(`🌐 Puerto asignado por Render: ${PORT}`);
  });
}

module.exports = app;