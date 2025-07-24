export function normalizeDriveLink(link) {
  const match = link.match(/https:\/\/drive\.google\.com\/uc.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) return link.trim();
  return `https://drive.google.com/uc?id=${match[1]}`;
}
