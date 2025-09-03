// ⚠️ IMPORTANTE: Este archivo es para el servidor, NO para la app móvil
// En el servidor, las sesiones se manejan con JWT o cookies

const crypto = require('crypto');

// Generar token JWT simple para sesiones
const generateToken = (userData) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: userData.id,
    email: userData.email,
    role: userData.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  
  // En producción, usar una clave secreta real
  const secret = process.env.JWT_SECRET || 'panda-app-secret-key';
  const signature = crypto.createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

// Verificar token JWT
const verifyToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const secret = process.env.JWT_SECRET || 'panda-app-secret-key';
    
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64');
    
    if (signature !== expectedSignature) return null;
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    // Verificar expiración
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    console.error('❌ Error verificando token:', error);
    return null;
  }
};

// Middleware para verificar autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token de acceso requerido' 
    });
  }
  
  const userData = verifyToken(token);
  if (!userData) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token inválido o expirado' 
    });
  }
  
  req.user = userData;
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken
};
