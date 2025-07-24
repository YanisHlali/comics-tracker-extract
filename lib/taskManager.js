import fs from "fs";
import path from "path";
import { downloadFile } from "./download.js";
import { extractArchive, flattenImagesToRoot } from "./extraction.js";
import { scheduleCleanup } from "./storage.js";

const progressMap = new Map();
const taskActivity = new Map();
const fileIdExtractionStatus = new Map();
const LAST_SEEN = 60 * 1000; // 60 sec

export function getProgressMap() {
  return progressMap;
}

export function getTaskActivity() {
  return taskActivity;
}

export function initTaskCleanup(accessTracker, idToUploadMap) {
  setInterval(() => {
    const now = Date.now();
    for (const [taskId, lastSeen] of taskActivity.entries()) {
      if (now - lastSeen > LAST_SEEN) {
        const taskData = progressMap.get(taskId);
        if (taskData?.status === "done") {
          const images = taskData.images || [];
          const id = images[0]?.split("/proxy-image/")[1]?.split("/")[0];
          if (id) {
            const extractDir = path.join("public", id);
            const uploadPath = idToUploadMap.get(id);
            try {
              if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
              if (uploadPath && fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
              console.log(`Suppression proactive du dossier et fichier pour taskId ${taskId}`);
            } catch (err) {
              console.error("Erreur de suppression proactive :", err);
            }
            progressMap.delete(taskId);
            accessTracker.delete(id);
            idToUploadMap.delete(id);
          }
        }
        taskActivity.delete(taskId);
      }
    }
  }, 10 * 1000);
}

export async function startExtractionTask(taskId, inputUrl, req) {
  const match = inputUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = match?.[1];

  if (!fileId) {
    progressMap.set(taskId, {
      progress: -1, 
      status: "error", 
      error: "Lien invalide", 
      message: "Le lien fourni est invalide."
    });
    return;
  }

  const extractDir = path.join("public", fileId);
  const tmpPath = path.join("uploads", `${fileId}.cbr`);
  const status = fileIdExtractionStatus.get(fileId);

  if (fs.existsSync(extractDir)) {
    const files = fs.readdirSync(extractDir).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
    if (files.length > 0) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = host.includes("localhost") ? "http" : "https";
      const images = files.map(f => `${proto}://${host}/api/proxy/proxy-image/${fileId}/${encodeURIComponent(f)}`);
      progressMap.set(taskId, {
        progress: 100, 
        status: "done", 
        message: "Fichier prêt à être affiché !", 
        images,
      });
      return;
    }
  }

  if (status && status.status === "pending") {
    let waited = 0;
    while (waited < 120000) {
      if (fs.existsSync(extractDir)) {
        const files = fs.readdirSync(extractDir).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
        if (files.length > 0) {
          const host = req.headers["x-forwarded-host"] || req.headers.host;
          const proto = host.includes("localhost") ? "http" : "https";
          const images = files.map(f => `${proto}://${host}/api/proxy/proxy-image/${fileId}/${encodeURIComponent(f)}`);
          progressMap.set(taskId, {
            progress: 100, 
            status: "done", 
            message: "Fichier prêt à être affiché !", 
            images,
          });
          return;
        }
      }
      await new Promise(res => setTimeout(res, 2000));
      waited += 2000;
    }
    progressMap.set(taskId, {
      progress: -1, 
      status: "error", 
      error: "Timeout", 
      message: "Extraction trop longue pour ce fichier."
    });
    return;
  }

  fileIdExtractionStatus.set(fileId, { status: "pending", time: Date.now() });

  try {
    progressMap.set(taskId, { 
      progress: 10, 
      status: "téléchargement", 
      message: "Téléchargement..." 
    });
    await downloadFile(fileId, tmpPath);

    progressMap.set(taskId, { 
      progress: 40, 
      status: "analyse", 
      message: "Analyse..." 
    });

    progressMap.set(taskId, { 
      progress: 60, 
      status: "extraction", 
      message: "Extraction..." 
    });
    await extractArchive(tmpPath, extractDir);

    progressMap.set(taskId, { 
      progress: 80, 
      status: "conversion", 
      message: "Conversion des images..." 
    });
    await flattenImagesToRoot(extractDir);

    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = host.includes("localhost") ? "http" : "https";
    const files = fs.readdirSync(extractDir).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
    const images = files.map(f => `${proto}://${host}/api/proxy/proxy-image/${fileId}/${encodeURIComponent(f)}`);

    if (!images.length) {
      throw new Error("Aucune image trouvée dans l'archive");
    }

    scheduleCleanup(tmpPath, extractDir);

    progressMap.set(taskId, { 
      progress: 100, 
      status: "done", 
      message: "Fichier prêt à être affiché !", 
      images 
    });
    
    fileIdExtractionStatus.set(fileId, { status: "done", time: Date.now() });
    setTimeout(() => fileIdExtractionStatus.delete(fileId), 10 * 60 * 1000);

  } catch (err) {
    console.error(`Erreur extraction taskId ${taskId}:`, err);
    progressMap.set(taskId, {
      progress: -1, 
      status: "error", 
      error: "Erreur extraction", 
      message: err.message
    });
    
    fileIdExtractionStatus.set(fileId, { status: "error", time: Date.now() });
    setTimeout(() => fileIdExtractionStatus.delete(fileId), 5 * 60 * 1000);
  }
}