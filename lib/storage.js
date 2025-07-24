import fs from "fs";
import path from "path";

const MAX_STORAGE = 30000 * 1024 * 1024; // 30 Go
const MAX_INACTIVE_TIME = 30 * 60 * 1000; // 30 min
const MAX_INACTIVE_TIME_UPLOADS = 10 * 60 * 1000; // 10 min

export function getFolderSize(folderPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        total += getFolderSize(fullPath);
      } else {
        total += fs.statSync(fullPath).size;
      }
    }
  } catch (error) {
    console.warn(`Erreur lecture dossier ${folderPath}:`, error.message);
  }
  return total;
}

export function cleanupIfDiskFull(accessTracker, idToUploadMap) {
  try {
    const publicSize = getFolderSize("public");
    const uploadsSize = getFolderSize("uploads");
    const totalUsed = publicSize + uploadsSize;

    console.log(`public/: ${(publicSize / 1024 / 1024).toFixed(1)} Mo`);
    console.log(`uploads/: ${(uploadsSize / 1024 / 1024).toFixed(1)} Mo`);
    console.log(`TOTAL = ${(totalUsed / 1024 / 1024).toFixed(1)} Mo`);

    if (totalUsed < MAX_STORAGE) return;

    console.log("Espace disque critique. Début du nettoyage sélectif...");

    if (fs.existsSync("public")) {
      const publicFolders = fs.readdirSync("public");
      for (const folder of publicFolders) {
        const fullPath = path.join("public", folder);
        const lastAccess = accessTracker.get(folder);
        const tooOld = !lastAccess || (Date.now() - lastAccess > MAX_INACTIVE_TIME);

        if (tooOld) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`Supprimé dans public/: ${folder} (dernier accès: ${lastAccess ? new Date(lastAccess).toISOString() : 'jamais'})`);
          accessTracker.delete(folder);

          const uploadPath = idToUploadMap.get(folder);
          if (uploadPath && fs.existsSync(uploadPath)) {
            fs.unlinkSync(uploadPath);
            console.log(`Fichier .cbr associé supprimé : ${uploadPath}`);
            idToUploadMap.delete(folder);
          }

          if (getFolderSize("public") + getFolderSize("uploads") < MAX_STORAGE) return;
        }
      }
    }

    if (fs.existsSync("uploads")) {
      const uploadFiles = fs.readdirSync("uploads");
      for (const file of uploadFiles) {
        const filePath = path.join("uploads", file);
        try {
          const stat = fs.statSync(filePath);
          const age = Date.now() - stat.mtimeMs;
          if (age > MAX_INACTIVE_TIME_UPLOADS) {
            fs.unlinkSync(filePath);
            console.log(`Supprimé dans uploads/: ${file}`);
            if (getFolderSize("public") + getFolderSize("uploads") < MAX_STORAGE) return;
          }
        } catch (e) {
          console.warn(`Erreur en lisant ${filePath}:`, e);
        }
      }
    }

  } catch (err) {
    console.error("Erreur de nettoyage automatique:", err);
  }
}

export function checkStorageAvailable() {
  const publicSize = getFolderSize("public");
  const uploadsSize = getFolderSize("uploads");
  const totalUsed = publicSize + uploadsSize;
  
  return totalUsed < MAX_STORAGE;
}

export function scheduleCleanup(filePath, extractDir) {
  const EXPIRATION_TIME = 30 * 60 * 1000; // 30 min
  console.log(`⏳ Nettoyage programmé dans ${EXPIRATION_TIME / 1000}s pour:`, filePath, extractDir);

  setTimeout(() => {
    console.log(`🧹 Nettoyage en cours...`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Fichier supprimé: ${filePath}`);
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      console.log(`Dossier supprimé: ${extractDir}`);
    }
  }, EXPIRATION_TIME);
}