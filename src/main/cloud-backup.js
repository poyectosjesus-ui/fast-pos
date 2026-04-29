const { google } = require('googleapis');
const http = require('http');
const { shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDb, getDbPath } = require('./database');

// Carga .env solo en desarrollo (en producción las vars ya están resueltas en el binario)
if (process.env.NODE_ENV === 'development') {
  try { require('dotenv').config(); } catch(e) { /* dotenv no instalado, continuar */ }
}

// ==========================================
// CONFIGURACIÓN OAUTH2 (GOOGLE CLOUD)
// ==========================================
// En DESARROLLO: se leen de .env (ver .env.example).
// En PRODUCCIÓN: electron-builder inyecta las vars del entorno CI al compilar,
//   o bien se setean en la máquina de build antes de ejecutar dist:mac/win.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3546/oauth2callback';

let oauth2Client = null;
let currentServer = null;

function getClient() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    try {
      const db = getDb();
      if (db) {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'google_drive_credentials'").get();
        if (row && row.value) {
          oauth2Client.setCredentials(JSON.parse(row.value));
        } else {
          // Fallback legacy a refresh_token
          const oldRow = db.prepare("SELECT value FROM settings WHERE key = 'google_drive_refresh_token'").get();
          if (oldRow && oldRow.value) {
            oauth2Client.setCredentials({ refresh_token: oldRow.value });
          }
        }
      }
    } catch (e) {
      console.warn("[Cloud] Error al leer credenciales google de config", e.message);
    }
  }
  return oauth2Client;
}

// 1. Inicia flujo: Abre web browser y levanta servidor local temporal.
async function getAuthUrl() {
  const client = getClient();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline', 
    prompt: 'consent', 
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });

  return new Promise((resolve, reject) => {
    // Si ya habia un server viejo, lo cerramos
    if (currentServer) {
      currentServer.close();
    }

    currentServer = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          const qs = new URL(req.url, 'http://localhost:3546').searchParams;
          const code = qs.get('code');
          const htmlResponse = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Conexión Exitosa - Fast-POS</title>
  <style>
    body {
      margin: 0; padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #312e81 100%);
      height: 100vh;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      padding: 40px; border-radius: 28px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center; max-width: 420px;
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-15px); }
      100% { transform: translateY(0px); }
    }
    .icon {
      width: 80px; height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 0 0 10px rgba(16, 185, 129, 0.15);
    }
    .icon svg {
      width: 40px; height: 40px;
      fill: none; stroke: white; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
      animation: check 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
    }
    @keyframes check {
      0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
      100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
    }
    h1 {
      margin: 0 0 16px; font-size: 28px; font-weight: 800; letter-spacing: -1px;
    }
    p {
      color: rgba(255, 255, 255, 0.7); font-size: 16px; line-height: 1.5; margin: 0 0 32px;
    }
    .btn {
      display: inline-block; background: #fff; color: #312e81; text-decoration: none;
      padding: 14px 28px; border-radius: 99px; font-weight: 900; text-transform: uppercase;
      letter-spacing: 1px; font-size: 12px; transition: all 0.2s; cursor: pointer; border: none;
    }
    .btn:hover {
      transform: scale(1.05); box-shadow: 0 10px 20px -10px rgba(255,255,255,0.5);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>
    </div>
    <h1>¡Nube Enlazada!</h1>
    <p>Google Drive otorgó permiso a Fast-POS con éxito para almacenar tus respaldos de forma segura.</p>
    <button onclick="window.close()" class="btn">Cerrar Pestaña</button>
  </div>
  <script>
     // Intentar cerrar automáticamente en algunos navegadores
     setTimeout(() => window.close(), 6000);
  </script>
</body>
</html>
          `;
          res.end(htmlResponse);
          currentServer.destroy(); // Cerramos servidor HTTP instántaneamente

          if (code) {
            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);

            let email = "Autenticado (Google Drive)";
            try {
               const oauth2 = google.oauth2({ auth: client, version: 'v2' });
               const res = await oauth2.userinfo.get();
               if (res.data.email) email = res.data.email;
            } catch(e) {}

            const db = getDb();
            // Guardamos todo el objeto tokens en DB para mayor fiabilidad, tenga o no refresh_token
            db.prepare(`INSERT INTO settings (key, value) VALUES ('google_drive_credentials', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(JSON.stringify(tokens));
            
            // Si además devolvió refresh_token, lo guardamos individual (para status y backward compat)
            if (tokens.refresh_token) {
               db.prepare(`INSERT INTO settings (key, value) VALUES ('google_drive_refresh_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(tokens.refresh_token);
            } else if (tokens.access_token) {
               db.prepare(`INSERT INTO settings (key, value) VALUES ('google_drive_refresh_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(tokens.access_token);
            }

            db.prepare(`INSERT INTO settings (key, value) VALUES ('google_drive_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(email);
            console.log("[Cloud] Credenciales guardadas exitosamente para", email);
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

    currentServer.listen(3546, () => {
      // Abrimos en el navegador Chrome default del usuario empujando el URL 
      shell.openExternal(authUrl);
      resolve({ success: true, url: authUrl });
    });

    // Add socket management to destroy forcefully
    const connections = new Set();
    currentServer.on('connection', socket => {
      connections.add(socket);
      socket.once('close', () => connections.delete(socket));
    });
    currentServer.destroy = () => {
      for (const sock of connections) sock.destroy();
      currentServer.close();
    };
  });
}

// 2. Lee el estado en disco
function getStatus() {
  try {
    const db = getDb();
    // Validamos primero el nuevo campo principal, o el fallback si son viejos.
    const rowCred = db.prepare("SELECT value FROM settings WHERE key = 'google_drive_credentials'").get();
    const rowTok  = db.prepare("SELECT value FROM settings WHERE key = 'google_drive_refresh_token'").get();
    
    if ((rowCred && rowCred.value) || (rowTok && rowTok.value)) {
       return {
         connected: true,
         email: db.prepare("SELECT value FROM settings WHERE key = 'google_drive_email'").get()?.value || "Sesión conectada"
       };
    }
    return { connected: false };
  } catch (e) {
    return { connected: false };
  }
}

// 3. Desconectar
function disconnect() {
  try {
    const db = getDb();
    db.prepare("DELETE FROM settings WHERE key = 'google_drive_refresh_token'").run();
    db.prepare("DELETE FROM settings WHERE key = 'google_drive_credentials'").run();
    db.prepare("DELETE FROM settings WHERE key = 'google_drive_email'").run();
    if (oauth2Client) oauth2Client.setCredentials(null);
  } catch(e) {}
  return { success: true };
}

// 4. Subir Respaldo
async function forceBackup() {
  try {
    const client = getClient();
    if (!client.credentials || !client.credentials.refresh_token) {
      throw new Error("No hay sesion activa con Google Drive.");
    }

    const drive = google.drive({ version: 'v3', auth: client });
    const dbPath = getDbPath();

    if (!fs.existsSync(dbPath)) {
      throw new Error("Base de datos local no encontrada.");
    }

    // Copiamos en caliente a un temporal para seguridad
    const tempPath = path.join(app.getPath("temp"), "fast-pos-backup.db");
    fs.copyFileSync(dbPath, tempPath);

    const now = new Date();
    const fileName = `Respaldo_FastPOS_${now.toISOString().split('T')[0]}.fastpos`;

    // --- Novedad: Lógica de Carpetas ---
    const folderName = "Respaldos Fast-POS";
    let folderId = null;
    
    const folderSearch = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
      folderId = folderSearch.data.files[0].id;
    } else {
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id'
      });
      folderId = folder.data.id;
    }

    const fileMetadata = { 
      name: fileName,
      parents: [folderId]
    };
    // ------------------------------------

    const media = {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(tempPath),
    };

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    // Cleanup temp
    fs.unlinkSync(tempPath);
    
    // Guardar timestamp de exito
    const db = getDb();
    db.prepare(`INSERT INTO settings (key, value) VALUES ('google_drive_last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(now.toISOString());

    return { success: true, fileId: res.data.id, timestamp: now.toISOString() };
  } catch (err) {
    console.error("[Cloud] Ocurrió un error subiendo archivo a Drive:", err);
    throw err;
  }
}

module.exports = {
  getAuthUrl,
  getStatus,
  disconnect,
  forceBackup
};
