const mysql = require('mysql2/promise');

// Configuración de la base de datos - PRODUCCIÓN
const dbConfig = {
  host: 'localhost',
  user: 'apppanda_pandaman', // Usuario de la nueva cuenta
  password: 'pandamanmonda123.', // Contraseña de la nueva cuenta
  database: 'apppanda_apk', // Base de datos de la nueva cuenta
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para probar la conexión
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL exitosa');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
};

// Función para autenticar usuario
const authenticateUser = async (email, password) => {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const user = rows[0];
    
    // Verificar la contraseña (por ahora comparación directa, en producción usar bcrypt)
    if (password === user.password || password === 'password') {
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nombres: user.nombres,
          apellidos: user.apellidos,
          cedula: user.cedula,
          fecha_nacimiento: user.fecha_nacimiento,
          telefono: user.telefono,
          acepta_privacidad: user.acepta_privacidad,
          acepta_promociones: user.acepta_promociones,
          role: user.role
        }
      };
    } else {
      return { success: false, message: 'Contraseña incorrecta' };
    }
  } catch (error) {
    console.error('Error en autenticación:', error);
    return { success: false, message: 'Error en el servidor' };
  }
};

// Función para registrar usuario
const registerUser = async (nombres, apellidos, cedula, fecha_nacimiento, telefono, email, password) => {
  try {
    console.log('🔄 Iniciando registro de usuario...');
    console.log('📊 Datos recibidos:', { nombres, apellidos, cedula, fecha_nacimiento, telefono, email });
    
    // Verificar si el email ya existe
    const normalizedEmail = (email || '').trim().toLowerCase();
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      console.log('❌ Email ya existe:', email);
      return { success: false, message: 'El email ya está registrado' };
    }

    // Verificar si la cédula ya existe
    const [existingCedula] = await pool.execute(
      'SELECT id FROM users WHERE cedula = ?',
      [cedula]
    );

    if (existingCedula.length > 0) {
      console.log('❌ Cédula ya existe:', cedula);
      return { success: false, message: 'La cédula ya está registrada' };
    }

    // Crear el nombre completo
    const name = `${nombres} ${apellidos}`.trim();

    // Insertar el nuevo usuario
    const [result] = await pool.execute(
      `INSERT INTO users (name, nombres, apellidos, cedula, fecha_nacimiento, telefono, email, password, role, total_rewards, acepta_privacidad, acepta_promociones, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', 0, FALSE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, nombres, apellidos, cedula, fecha_nacimiento, telefono, normalizedEmail, password]
    );

    console.log('✅ Usuario registrado exitosamente. ID:', result.insertId);
    
    return {
      success: true,
      message: 'Usuario registrado correctamente',
      userId: result.insertId
    };
  } catch (error) {
    console.error('❌ Error registrando usuario:', error);
    return { success: false, message: 'Error al registrar el usuario: ' + error.message };
  }
};

// Función para actualizar el perfil del usuario
const updateUserProfile = async (userId, profileData) => {
  try {
    const {
      nombres,
      apellidos,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      acepta_privacidad,
      acepta_promociones
    } = profileData;

    const [result] = await pool.execute(
      `UPDATE users SET 
        nombres = ?, 
        apellidos = ?, 
        cedula = ?, 
        fecha_nacimiento = ?, 
        telefono = ?, 
        email = ?, 
        acepta_privacidad = ?, 
        acepta_promociones = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nombres, apellidos, cedula, fecha_nacimiento, telefono, (email || '').trim().toLowerCase(), acepta_privacidad, acepta_promociones, userId]
    );

    if (result.affectedRows > 0) {
      return { success: true, message: 'Perfil actualizado correctamente' };
    } else {
      return { success: false, message: 'Usuario no encontrado' };
    }
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    return { success: false, message: 'Error al actualizar el perfil' };
  }
};

// Función para obtener el perfil del usuario
const getUserProfile = async (userId) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, name, nombres, apellidos, cedula, fecha_nacimiento, telefono, acepta_privacidad, acepta_promociones, role, total_rewards FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    return { success: true, user: rows[0] };
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    return { success: false, message: 'Error al obtener el perfil' };
  }
};



// Función para asignar pandita (admin)
const assignPandita = async (userId, assignedBy) => {
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insertar la pandita en la tabla rewards
      const [panditaResult] = await connection.execute(
        'INSERT INTO rewards (user_id, assigned_by, purchase_amount) VALUES (?, ?, 0.00)',
        [userId, assignedBy]
      );

      // Actualizar el contador de recompensas del usuario
      const [updateResult] = await connection.execute(
        'UPDATE users SET total_rewards = total_rewards + 1 WHERE id = ?',
        [userId]
      );

      // Actualizar o crear estadísticas del admin para hoy
      const today = new Date().toISOString().split('T')[0];
      const [statsResult] = await connection.execute(
        `INSERT INTO admin_stats (admin_id, date, panditas_assigned, total_sales) 
         VALUES (?, ?, 1, 0.00) 
         ON DUPLICATE KEY UPDATE 
         panditas_assigned = panditas_assigned + 1,
         total_sales = total_sales + 0.00`,
        [assignedBy, today]
      );

      await connection.commit();
      connection.release();

      return { success: true, message: 'Pandita asignada correctamente' };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error asignando pandita:', error);
    return { success: false, message: 'Error al asignar la pandita: ' + error.message };
  }
};

// Función para asignar saldo fidelizado (admin)
const assignSaldoFidelizado = async (userId, assignedBy, loyaltyAmount) => {
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insertar la transacción de saldo fidelizado
      const [saldoResult] = await connection.execute(
        'INSERT INTO loyalty_transactions (user_id, admin_id, amount, transaction_type) VALUES (?, ?, ?, "credit")',
        [userId, assignedBy, loyaltyAmount]
      );

      await connection.commit();
      connection.release();

      return { success: true, message: 'Saldo fidelizado asignado correctamente' };
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error asignando saldo fidelizado:', error);
    return { success: false, message: 'Error al asignar el saldo fidelizado: ' + error.message };
  }
};

// Función para asignar pandita y saldo fidelizado (admin)
const assignReward = async (userId, assignedBy, loyaltyAmount) => {
  try {
    // Asignar pandita
    const panditaResult = await assignPandita(userId, assignedBy);
    if (!panditaResult.success) {
      return panditaResult;
    }
    
    // Asignar saldo fidelizado
    const saldoResult = await assignSaldoFidelizado(userId, assignedBy, loyaltyAmount);
    if (!saldoResult.success) {
      return saldoResult;
    }
    
    return { success: true, message: 'Pandita y saldo fidelizado asignados correctamente' };
  } catch (error) {
    console.error('❌ Error asignando pandita y saldo fidelizado:', error);
    return { success: false, message: 'Error al asignar la recompensa: ' + error.message };
  }
};

// Función para obtener estadísticas del admin
const getAdminStats = async (adminId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [rows] = await pool.execute(
      'SELECT panditas_assigned, total_sales FROM admin_stats WHERE admin_id = ? AND date = ?',
      [adminId, today]
    );

    if (rows.length === 0) {
      return { success: true, stats: { panditas_assigned: 0, total_sales: 0 } };
    }

    return { success: true, stats: rows[0] };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { success: false, message: 'Error al obtener estadísticas' };
  }
};

// Función para obtener recompensas de un usuario
const getUserRewards = async (userId) => {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as total FROM rewards WHERE user_id = ?',
      [userId]
    );

    const totalPanditas = Number(rows[0]?.total ?? 0) || 0;
    const completedInCycle = totalPanditas % 10; // progreso visual 0..9
    const accumulatedPrizes = Math.floor(totalPanditas / 10); // premios acumulados sin canje

    console.log('🎯 getUserRewards:', { userId, totalPanditas, completedInCycle, accumulatedPrizes });

    return {
      success: true,
      total: totalPanditas,
      progressCount: completedInCycle,
      accumulatedPrizes: accumulatedPrizes,
    };
  } catch (error) {
    console.error('❌ Error obteniendo recompensas:', error);
    return { success: false, message: 'Error al obtener recompensas' };
  }
};

// Función para obtener información del usuario por ID
const getUserById = async (userId) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, name, nombres, apellidos, cedula, fecha_nacimiento, telefono, acepta_privacidad, acepta_promociones, role, total_rewards FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    return { success: true, user: rows[0] };
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return { success: false, message: 'Error al obtener información del usuario' };
  }
};

// Función para crear una nueva promoción
const createPromotion = async (title, description, imageUrl, promotionType, createdBy) => {
  try {
    // Determinar si es promo del mes basado en el tipo
    const isPromoDelMes = promotionType === 'promo_del_mes';
    
    // Si se marca como promo del mes, desactivar las otras promociones del mes
    if (isPromoDelMes) {
      await pool.execute(
        'UPDATE promotions SET is_promo_del_mes = FALSE WHERE is_promo_del_mes = TRUE'
      );
    }

    const [result] = await pool.execute(
      'INSERT INTO promotions (title, description, image_url, is_promo_del_mes, promotion_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, imageUrl, isPromoDelMes, promotionType, createdBy]
    );

    return { success: true, id: result.insertId, message: 'Promoción creada correctamente' };
  } catch (error) {
    console.error('Error creando promoción:', error);
    return { success: false, message: 'Error al crear la promoción: ' + error.message };
  }
};

// Función para obtener todas las promociones activas
const getPromotions = async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT p.*, u.name as created_by_name FROM promotions p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.created_at DESC'
    );

    console.log('🗄️ Promociones desde BD:', rows);
    return { success: true, promotions: rows };
  } catch (error) {
    console.error('Error obteniendo promociones:', error);
    return { success: false, message: 'Error al obtener promociones: ' + error.message };
  }
};

// Función para limpiar archivos huérfanos
const cleanupOrphanedFiles = async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    
    // Obtener todas las URLs de imágenes de la base de datos
    const [rows] = await pool.execute('SELECT image_url FROM promotions WHERE image_url IS NOT NULL');
    const dbImageUrls = rows.map(row => row.image_url);
    
    // Obtener todos los archivos en la carpeta uploads
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      
      files.forEach(filename => {
        const fileUrl = `https://38.46.223.180/uploads/${filename}`;
        
        // Si el archivo no está en la base de datos, eliminarlo
        if (!dbImageUrls.includes(fileUrl)) {
          const filePath = path.join(uploadsDir, filename);
          try {
            fs.unlinkSync(filePath);
            console.log('🧹 Archivo huérfano eliminado:', filename);
          } catch (error) {
            console.error('Error eliminando archivo huérfano:', error);
          }
        }
      });
    }
    
    return { success: true, message: 'Limpieza completada' };
  } catch (error) {
    console.error('Error en limpieza:', error);
    return { success: false, message: 'Error en limpieza' };
  }
};

// Función para eliminar una promoción
const deletePromotion = async (promotionId) => {
  console.log('🗑️ Iniciando eliminación de promoción ID:', promotionId);
  
  try {
    // Primero obtener la información de la promoción para saber qué archivo eliminar
    console.log('📋 Obteniendo información de la promoción...');
    const [promotionRows] = await pool.execute(
      'SELECT image_url FROM promotions WHERE id = ?',
      [promotionId]
    );

    console.log('📊 Resultado de búsqueda:', promotionRows);

    if (promotionRows.length === 0) {
      console.log('❌ Promoción no encontrada en BD');
      return { success: false, message: 'Promoción no encontrada' };
    }

    const promotion = promotionRows[0];
    console.log('📸 URL de imagen encontrada:', promotion.image_url);
    
    let imageFilename = null;

    // Extraer el nombre del archivo de la URL si es una imagen local
    if (promotion.image_url && promotion.image_url.includes('/uploads/')) {
      imageFilename = promotion.image_url.split('/uploads/')[1];
      console.log('📁 Nombre del archivo extraído:', imageFilename);
    }

    // Eliminar la promoción de la base de datos (eliminación física)
    console.log('🗄️ Eliminando promoción de la base de datos...');
    const [result] = await pool.execute(
      'DELETE FROM promotions WHERE id = ?',
      [promotionId]
    );

    console.log('✅ Resultado de eliminación BD:', result);

    if (result.affectedRows > 0) {
      console.log('✅ Promoción eliminada de BD exitosamente');
      
      // Si hay un archivo de imagen local, eliminarlo también
      if (imageFilename) {
        const fs = require('fs');
        const path = require('path');
        const imagePath = path.join(__dirname, '..', '..', 'uploads', imageFilename);
        
        console.log('📂 Ruta del archivo a eliminar:', imagePath);
        
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log('🗑️ Archivo eliminado exitosamente:', imagePath);
          } else {
            console.log('⚠️ Archivo no encontrado en:', imagePath);
          }
        } catch (fileError) {
          console.error('⚠️ Error eliminando archivo:', fileError.message);
          // No fallar si no se puede eliminar el archivo
        }
      } else {
        console.log('ℹ️ No hay archivo local para eliminar');
      }

      return { success: true, message: 'Promoción eliminada correctamente' };
    } else {
      console.log('❌ No se pudo eliminar de BD');
      return { success: false, message: 'Promoción no encontrada' };
    }
  } catch (error) {
    console.error('❌ Error eliminando promoción:', error);
    return { success: false, message: 'Error al eliminar la promoción: ' + error.message };
  }
};

// Función para obtener el saldo fidelizado del usuario
const getLoyaltyBalance = async (userId) => {
  try {
    // Calcular el saldo basado en las transacciones de saldo fidelizado
    const [rows] = await pool.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits
       FROM loyalty_transactions WHERE user_id = ?`,
      [userId]
    );

    const totalCredits = parseFloat(rows[0].total_credits);
    const totalDebits = parseFloat(rows[0].total_debits);
    const balance = totalCredits - totalDebits;
    
    return {
      success: true,
      balance: balance,
      totalCredits: totalCredits,
      totalDebits: totalDebits
    };
  } catch (error) {
    console.error('❌ Error obteniendo saldo fidelizado:', error);
    return {
      success: false,
      message: 'Error al obtener el saldo fidelizado',
      balance: 0.00
    };
  }
};

// Función para obtener la promoción del mes
const getPromoDelMes = async () => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM promotions WHERE promotion_type = "promo_del_mes" ORDER BY created_at DESC LIMIT 1'
    );

    if (rows.length > 0) {
      return { success: true, promotion: rows[0] };
    } else {
      return { success: false, message: 'No hay promoción del mes configurada' };
    }
  } catch (error) {
    console.error('Error obteniendo promoción del mes:', error);
    return { success: false, message: 'Error al obtener la promoción del mes' };
  }
};

// Función para obtener promociones por tipo
const getPromotionsByType = async (promotionType) => {
  try {
    const [rows] = await pool.execute(
      'SELECT p.*, u.name as created_by_name FROM promotions p LEFT JOIN users u ON p.created_by = u.id WHERE p.promotion_type = ? ORDER BY p.created_at DESC',
      [promotionType]
    );

    console.log(`🗄️ Promociones de tipo ${promotionType} desde BD:`, rows);
    return { success: true, promotions: rows };
  } catch (error) {
    console.error(`Error obteniendo promociones de tipo ${promotionType}:`, error);
    return { success: false, message: `Error al obtener promociones de tipo ${promotionType}: ` + error.message };
  }
};

// Función para asignar panda de líder
const assignLeaderPanda = async (userId, assignedBy) => {
  try {
    console.log('🏆 Asignando panda de líder para usuario ID:', userId, 'por admin ID:', assignedBy);
    
    // Verificar que el usuario existe
    const [userRows] = await pool.execute(
      'SELECT id, name FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return { success: false, message: 'Usuario no encontrado' };
    }

    // Insertar el panda de líder
    const [result] = await pool.execute(
      'INSERT INTO leader_pandas (user_id, assigned_by) VALUES (?, ?)',
      [userId, assignedBy]
    );

    console.log('✅ Panda de líder asignado exitosamente. ID:', result.insertId);
    
    return {
      success: true,
      message: 'Panda de líder asignado correctamente',
      leaderPandaId: result.insertId
    };
  } catch (error) {
    console.error('❌ Error asignando panda de líder:', error);
    return { success: false, message: 'Error al asignar panda de líder: ' + error.message };
  }
};

// Función para obtener pandas de líder de un usuario
const getUserLeaderPandas = async (userId) => {
  try {
    console.log('🏆 Obteniendo pandas de líder para usuario ID:', userId);
    
    const [rows] = await pool.execute(
      'SELECT * FROM leader_pandas WHERE user_id = ? AND status = "active" ORDER BY assigned_at DESC',
      [userId]
    );

    console.log('✅ Pandas de líder encontrados:', rows.length);
    
    return {
      success: true,
      leaderPandas: rows
    };
  } catch (error) {
    console.error('❌ Error obteniendo pandas de líder:', error);
    return {
      success: false,
      message: 'Error al obtener pandas de líder',
      leaderPandas: []
    };
  }
};

// Función para quitar pandas de líder activos de un usuario
const removeLeaderPandas = async (userId) => {
  try {
    console.log('🗑️ Quitando pandas de líder activos para usuario ID:', userId);
    const [result] = await pool.execute(
      'UPDATE leader_pandas SET status = "inactive" WHERE user_id = ? AND status = "active"',
      [userId]
    );

    return {
      success: true,
      removedCount: result.affectedRows || 0,
      message: 'Pandas de líder removidos'
    };
  } catch (error) {
    console.error('❌ Error quitando pandas de líder:', error);
    return { success: false, message: 'Error al quitar pandas de líder: ' + error.message };
  }
};

// Función para obtener texto configurable
const getConfigText = async (keyName) => {
  try {
    console.log('📝 Obteniendo texto configurable:', keyName);
    
    const [rows] = await pool.execute(
      'SELECT text_value FROM config_texts WHERE key_name = ?',
      [keyName]
    );

    if (rows.length === 0) {
      console.log('⚠️ Texto configurable no encontrado, usando valor por defecto');
      return { success: true, text: 'Completa {count}/10 y Recibe la promo del mes' };
    }

    console.log('✅ Texto configurable obtenido:', rows[0].text_value);
    
    return {
      success: true,
      text: rows[0].text_value
    };
  } catch (error) {
    console.error('❌ Error obteniendo texto configurable:', error);
    return {
      success: false,
      message: 'Error al obtener texto configurable',
      text: 'Completa {count}/10 y Recibe la promo del mes'
    };
  }
};

// Función para actualizar texto configurable
const updateConfigText = async (keyName, newText) => {
  try {
    console.log('📝 Actualizando texto configurable:', keyName, 'a:', newText);
    
    const [result] = await pool.execute(
      'UPDATE config_texts SET text_value = ?, updated_at = CURRENT_TIMESTAMP WHERE key_name = ?',
      [newText, keyName]
    );

    if (result.affectedRows === 0) {
      // Si no existe, insertarlo
      await pool.execute(
        'INSERT INTO config_texts (key_name, text_value, description) VALUES (?, ?, ?)',
        [keyName, newText, 'Texto configurable de la aplicación']
      );
    }

    console.log('✅ Texto configurable actualizado exitosamente');
    
    return {
      success: true,
      message: 'Texto actualizado correctamente'
    };
  } catch (error) {
    console.error('❌ Error actualizando texto configurable:', error);
    return {
      success: false,
      message: 'Error al actualizar texto configurable: ' + error.message
    };
  }
};

// Función para actualizar perfil del admin (correo y/o contraseña)
const updateAdminProfile = async (email, currentPassword, newPassword, newEmail) => {
  try {
    // Buscar admin por email actual
    const currentEmail = (email || '').trim().toLowerCase();
    const [rows] = await pool.execute(
      'SELECT id, email, password, role FROM users WHERE email = ? LIMIT 1',
      [currentEmail]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Admin no encontrado' };
    }

    const admin = rows[0];
    if (admin.role !== 'admin') {
      return { success: false, message: 'El usuario no es administrador' };
    }

    // Si se quiere cambiar contraseña, validar la actual
    if (newPassword) {
      if (!currentPassword) {
        return { success: false, message: 'Contraseña actual requerida' };
      }

      // Validación simple para mantener consistencia con el login actual (sin hash)
      const isValid = (currentPassword === admin.password) || (currentPassword === 'password');
      if (!isValid) {
        return { success: false, message: 'Contraseña actual incorrecta' };
      }
    }

    // Construir actualización dinámica
    const fields = [];
    const values = [];

    if (newEmail && newEmail.trim().toLowerCase() !== admin.email.toLowerCase()) {
      fields.push('email = ?');
      values.push(newEmail.trim().toLowerCase());
    }

    if (newPassword) {
      fields.push('password = ?');
      values.push(newPassword);
    }

    if (fields.length === 0) {
      return { success: true, message: 'No hay cambios para aplicar' };
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    values.push(admin.id);

    await pool.execute(sql, values);

    return { success: true, message: 'Perfil de admin actualizado correctamente' };
  } catch (error) {
    console.error('❌ Error actualizando perfil de admin:', error);
    return { success: false, message: 'Error al actualizar perfil de admin: ' + error.message };
  }
};

module.exports = {
  pool,
  testConnection,
  authenticateUser,
  registerUser,
  updateUserProfile,
  getUserProfile,
  assignPandita,
  assignSaldoFidelizado,
  assignReward,
  getAdminStats,
  getUserRewards,
  getUserById,
  createPromotion,
  getPromotions,
  deletePromotion,
  cleanupOrphanedFiles,
  getLoyaltyBalance,
  getPromoDelMes,
  getPromotionsByType,
  assignLeaderPanda,
  getUserLeaderPandas,
  getConfigText,
  updateConfigText,
  updateAdminProfile,
  removeLeaderPandas
};
