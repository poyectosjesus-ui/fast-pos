const crypto = require("crypto");

/**
 * Modulo de validación offline estricta de licencias.
 * SE UTILIZA EN EL ENTORNO NODE.JS (MAIN PROCESS).
 */

// NOTA: En un entorno comercial de gran escala esto debe venir ofuscado 
// por variables de entorno y empaquetadores (Webpack/Vite), pero para 
// efectos de esta arquitectura base (MVP), quemamos la llave simétrica aquí.
const LICENSE_SECRET_KEY = "F4ST_P0S_ULT1M4T3_S3CR3T_K3Y_2026_X0";

/**
 * Valida matemáticamente una licencia de Fast-POS.
 * Formato esperado: FAST-{PAYLOAD_BASE64}-{HMAC_SIGNATURE}
 * 
 * Ejemplo de Payload Interno (JSON Stringificado):
 * { "client": "Abarrotes", "plan": "PRO", "exp": 1735689600000, "stores": 1 }
 * 
 * @param {string} rawKey La licencia proveída por el usuario.
 * @returns {{isValid: boolean, payload?: any, error?: string}}
 */
function validateLicenseKey(rawKey) {
  try {
    if (!rawKey || typeof rawKey !== 'string') {
      return { isValid: false, error: "Formato inválido" };
    }

    const parts = rawKey.split("-");
    
    // Debe empezar con FAST, tener el payload y la firma
    // Ej: FAST - <payloadBase64> - <firmaHex>
    if (parts.length < 3 || parts[0] !== "FAST") {
      return { isValid: false, error: "Estructura de clave irreconocible" };
    }

    const payloadBase64 = parts[1];
    const incomingSignature = parts[2];

    // Recreamos la firma usando nuestra propia llave maestra
    const expectedSignature = crypto
      .createHmac("sha256", LICENSE_SECRET_KEY)
      .update(payloadBase64)
      .digest("hex")
      .substring(0, 16); // Truncamos a 16 chars para que la licencia no sea kilométrica

    // Validación Criptográfica Estricta (Time-Safe Compare para evitar Timing Attacks)
    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(incomingSignature)
    );

    if (!isValidSignature) {
      return { isValid: false, error: "Firma digital no válida (Piratería detectada)" };
    }

    // Si la firma matemática coincide, el Payload de texto es confiable (no fue alterado).
    // Procedemos a decodificarlo.
    const jsonStr = Buffer.from(payloadBase64, "base64").toString("utf8");
    const payload = JSON.parse(jsonStr);

    // Revisar expiración temporal (si aplica)
    if (payload.exp && payload.exp !== "LIFETIME") {
      const expirationDate = new Date(payload.exp).getTime();
      const now = Date.now();
      
      if (now > expirationDate) {
        return { isValid: false, error: "ESTADO: EXPIRADA", payload };
      }
    }

    return { isValid: true, payload };
  } catch (err) {
    return { isValid: false, error: "Licencia corrupta o malformada" };
  }
}

module.exports = {
  validateLicenseKey,
  LICENSE_SECRET_KEY, // Exportada temporalmente para que el Generator Script pueda usarla
};
