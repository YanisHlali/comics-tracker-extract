import express from "express";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { allowedDriveLinksPromise } from "./allowedLinks.js";
import { normalizeDriveLink } from "./normalizeDriveLink.js";
import { checkStorageAvailable } from "./storage.js";
import { startExtractionTask, getProgressMap, getTaskActivity } from "./taskManager.js";

const router = express.Router();

router.post("/from-drive", async (req, res) => {
  const taskId = uuidv4();
  const progressMap = getProgressMap();
  
  progressMap.set(taskId, { 
    progress: 0, 
    status: "initialisation" 
  });

  if (!checkStorageAvailable()) {
    progressMap.set(taskId, { 
      progress: -1, 
      status: "error", 
      error: "Stockage plein" 
    });
    return res.status(507).json({ error: "Stockage plein", taskId });
  }

  const inputUrl = req.body.url || "";
  const normalizedUrl = normalizeDriveLink(inputUrl);
  const allowedDriveLinks = await allowedDriveLinksPromise;

  if (!allowedDriveLinks.has(normalizedUrl)) {
    console.log(`Lien interdit: ${normalizedUrl}`);
    return res.status(403).json({ error: "Lien interdit", taskId });
  }

  console.log(`Lien autorisé: ${normalizedUrl}`);

  setTimeout(() => {
    startExtractionTask(taskId, normalizedUrl, req);
  }, 10);

  res.json({ taskId });
});

router.get("/cbr/:id/:image", (req, res, accessTracker) => {
  const { id, image } = req.params;
  const filePath = path.join("public", id, decodeURIComponent(image));
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Image not found.");
  }

  accessTracker.set(id, Date.now());

  const ext = path.extname(image).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");

  fs.createReadStream(filePath).pipe(res);
});

router.get("/progress/:taskId", (req, res) => {
  const { taskId } = req.params;
  const progressMap = getProgressMap();
  const data = progressMap.get(taskId);
  
  if (!data) {
    return res.status(404).json({ error: "Tâche inconnue" });
  }
  
  res.json(data);
});

router.post("/viewer-alive/:taskId", (req, res) => {
  const { taskId } = req.params;
  const taskActivity = getTaskActivity();
  
  taskActivity.set(taskId, Date.now());
  res.sendStatus(204);
});

router.post("/viewer-cleanup/:taskId", async (req, res) => {
  const { taskId } = req.params;
  try {
    const publicDir = path.join("public", taskId);
    const uploadFile = path.join("uploads", `${taskId}.cbr`);

    let deleted = false;
    if (fs.existsSync(publicDir)) {
      await fs.promises.rm(publicDir, { recursive: true, force: true });
      deleted = true;
    }
    if (fs.existsSync(uploadFile)) {
      await fs.promises.rm(uploadFile, { force: true });
      deleted = true;
    }

    const progressMap = getProgressMap();
    const taskActivity = getTaskActivity();
    progressMap.delete(taskId);
    taskActivity.delete(taskId);

    if (deleted) {
      console.log(`[viewer-cleanup] Suppression OK pour taskId ${taskId}`);
    } else {
      console.log(`[viewer-cleanup] Rien à supprimer pour taskId ${taskId}`);
    }
    res.sendStatus(204);
  } catch (err) {
    console.error(`[viewer-cleanup] Erreur suppression pour taskId ${taskId}:`, err);
    res.sendStatus(204);
  }
});

router.get("/", (req, res) => {
  res.send("Serveur opérationnel !");
});

export default router;