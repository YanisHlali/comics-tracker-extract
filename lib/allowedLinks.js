import fetch from "node-fetch";

async function getAllAllowedDriveLinksFromAPI(apiBase = "http://localhost:8080/api") {
  const links = new Set();

  let periods;
  try {
    const res = await fetch(`${apiBase}/periods`);
    periods = await res.json();
    console.log("Periods récupérés:", periods);
  } catch (e) {
    console.warn("Impossible de récupérer les périodes :", e);
    return links;
  }

  for (const period of periods) {
    const periodId = typeof period === "string" ? period : period.id;
    try {
      const url = `${apiBase}/french-editions?periodName=${encodeURIComponent(periodId)}`;
      console.log("Requête éditions :", url);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Erreur sur la période ${periodId} :`, res.status, await res.text());
        continue;
      }
      const editions = await res.json();
      editions.forEach(edition => {
        if (edition.link) {
          const normalized = edition.link.replace("uc?&id=", "uc?id=").trim();
          links.add(normalized);
        }
      });
    } catch (e) {
      console.warn(`Erreur sur la période ${periodId} :`, e);
    }
  }

  console.log("NOMBRE FINAL DE LIENS AUTORISÉS:", links.size);
  return links;
}

export const allowedDriveLinksPromise = getAllAllowedDriveLinksFromAPI();
