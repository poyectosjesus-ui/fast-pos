#!/usr/bin/env node

/**
 * =========================================================================
 * FAST-POS: GENERADOR Y FIRMANTE DE LICENCIAS (ADMIN CLI)
 * =========================================================================
 * 
 * Este script es de uso EXCLUSIVO para el dueño del código base de Fast-POS.
 * NO SE DEBE DISTRIBUIR CON EL EMPAQUETADO FINAL (Electron Build).
 * 
 * Función: Crea un payload criptográfico, lo firma con el Secreto Maestro,
 * y devuelve la Llave (Ej. FAST-xxxxxx-yyyyyy) lista para enviársela al cliente.
 */

const crypto = require("crypto");
// Importamos el HMAC Secret exactamente como está del lado del cliente Validador
const { LICENSE_SECRET_KEY } = require("../src/main/licensing.js");

// Argumentos nativos de CLI
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
🚀 Fast-POS License Tool 🚀

Uso:
  node scripts/keygen.js --client "Nombre Cliente" --plan "PRO" --days 365 --stores 1

Opciones:
  --client     Nombre de la empresa o cliente (Obligatorio)
  --plan       Tipo de Plan (BASIC, PRO, ENTERPRISE) [Default: PRO]
  --days       Vigencia en días (o '0' para LIFETIME) [Default: 365]
  --minutes    Vigencia en minutos (sólo para pruebas, sobreescribe days)
  --stores     Máximo de sucursales permitidas [Default: 1]
  
Ejemplo:
  node scripts/keygen.js --client "Abarrotes XYZ" --plan BASIC --days 30
  `);
  process.exit(0);
}

// Analizador simple de argumentos
const params = {
  client: null,
  plan: "PRO",
  days: 365,
  minutes: null,
  stores: 1
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--help" || args[i] === "-h") showHelp();
  if (args[i] === "--client") params.client = args[i + 1];
  if (args[i] === "--plan") params.plan = args[i + 1];
  if (args[i] === "--days") params.days = parseInt(args[i + 1], 10);
  if (args[i] === "--minutes") params.minutes = parseInt(args[i + 1], 10);
  if (args[i] === "--stores") params.stores = parseInt(args[i + 1], 10);
}

if (!params.client) {
  console.error("❌ ERROR: Debes especificar el nombre del cliente (--client).");
  showHelp();
}

/**
 * 1. Definir el Payload (Metadatos Transparentes)
 */
const expirationTimestamp = params.minutes != null
  ? Date.now() + (params.minutes * 60 * 1000)
  : params.days === 0 
    ? "LIFETIME" 
    : Date.now() + (params.days * 24 * 60 * 60 * 1000);

const payloadObj = {
  client: params.client,
  plan: params.plan,
  exp: expirationTimestamp,
  stores: params.stores,
  issuedAt: Date.now()
};

// Convertir a string JSON y luego a Base64
const jsonStr = JSON.stringify(payloadObj);
const payloadBase64 = Buffer.from(jsonStr).toString("base64");

/**
 * 2. Firmar Matemáticamente el Payload (Firma Segura)
 */
const signature = crypto
  .createHmac("sha256", LICENSE_SECRET_KEY)
  .update(payloadBase64)
  .digest("hex")
  .substring(0, 16); // Mismos 16 caracteres de truncado que el Validador

/**
 * 3. Ensamblar la Clave de Venta Final
 */
const finalLicenseKey = `FAST-${payloadBase64}-${signature}`;

const fs = require("fs");
const outputDir = process.cwd();
const safeName = params.client.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
const fileName = `${safeName}.fastkey`;
const filePath = require("path").join(outputDir, fileName);
fs.writeFileSync(filePath, finalLicenseKey, "utf8");

console.log("\n=======================================================");
console.log("🟢 LICENCIA GENERADA CON ÉXITO");
console.log("=======================================================");
console.log("");
console.log("  📌 CLIENTE      :", params.client);
console.log("  📦 PLAN         :", params.plan);
console.log("  🗓  VIGENCIA     :", params.minutes != null ? `${params.minutes} Minuto(s)` : params.days === 0 ? "ILIMITADA (Lifetime)" : `${params.days} Días`);
console.log("  🏪 MAX SUCURSALES:", params.stores);
console.log("");
console.log("==================== ARCHIVO GENERADO =====================");
console.log("");
console.log("  📄 Archivo .fastkey:", fileName);
console.log("  📂 Ubicación:", filePath);
console.log("");
console.log("==================== CLAVE EN TEXTO =====================");
console.log("");
console.log(finalLicenseKey);
console.log("");
console.log("=======================================================\n");
