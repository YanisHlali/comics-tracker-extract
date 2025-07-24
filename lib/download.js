import https from "https";
import { parse } from "node-html-parser";
import { URL } from "url";
import { pipeline } from "stream";
import { promisify } from "util";
import fs from "fs";

const streamPipeline = promisify(pipeline);

export function fetchRedirect(downloadUrl) {
  return new Promise((resolve, reject) => {
    const performRequest = (url, visited = new Set()) => {
      if (visited.has(url)) return reject(new Error("Redirection loop"));
      visited.add(url);

      https.get(url, (res) => {
        const { statusCode, headers } = res;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          return performRequest(new URL(headers.location, url).toString(), visited);
        }

        if (statusCode === 200 && headers["content-type"]?.startsWith("application")) {
          return resolve(res);
        }

        if (statusCode === 200 && headers["content-type"]?.includes("text/html")) {
          let html = "";
          res.on("data", (chunk) => (html += chunk));
          res.on("end", () => {
            const root = parse(html);
            const form = root.querySelector('form[action*="download"]');
            if (!form) return reject(new Error("Formulaire manquant"));
            const action = form.getAttribute("action");
            const params = new URLSearchParams();
            form.querySelectorAll("input").forEach((i) => {
              const name = i.getAttribute("name");
              const value = i.getAttribute("value");
              if (name && value) params.append(name, value);
            });
            performRequest(`${action}?${params}`, visited);
          });
        } else {
          reject(new Error(`Échec HTTP ${statusCode}`));
        }
      }).on("error", reject);
    };

    performRequest(downloadUrl);
  });
}

export async function downloadFile(fileId, tmpPath) {
  if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 0) {
    console.log(`Fichier déjà téléchargé: ${tmpPath}`);
    return;
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log(`Téléchargement: ${downloadUrl}`);

  const response = await fetchRedirect(downloadUrl);
  await streamPipeline(response, fs.createWriteStream(tmpPath));
  
  console.log(`Téléchargement terminé: ${tmpPath}`);
}