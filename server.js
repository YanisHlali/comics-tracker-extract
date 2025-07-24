import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { cleanupIfDiskFull } from "./lib/storage.js";
import { initTaskCleanup } from "./lib/taskManager.js";
import routes from "./lib/routes.js";

const app = express();
const PORT = 4000;

const accessTracker = new Map();
const idToUploadMap = new Map();

if (!fs.existsSync("public")) {
  fs.mkdirSync("public", { recursive: true });
}
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

app.use(express.json());

app.use(cors({
  origin: ["https://comics-tracker.vercel.app", "http://localhost:3000"],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.sendStatus(204);
});

app.use((req, res, next) => {
  req.accessTracker = accessTracker;
  req.idToUploadMap = idToUploadMap;
  next();
});

app.get("/cbr/:id/:image", (req, res) => {
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

app.use("/", routes);

initTaskCleanup(accessTracker, idToUploadMap);

setInterval(() => {
  cleanupIfDiskFull(accessTracker, idToUploadMap);
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Serveur en ligne : http://localhost:${PORT}`);
});