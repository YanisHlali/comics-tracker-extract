import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function flattenImagesToRoot(extractDir, currentDir = extractDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await flattenImagesToRoot(extractDir, fullPath);
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else if (/\.(jpe?g|png|gif|webp|tiff?|bmp)$/i.test(entry.name)) {

      let needsConversion = false;
      let finalExtension = path.extname(entry.name).toLowerCase();

      try {
        const { stdout: fileType } = await execAsync(`file -b "${fullPath}"`);
        const ext = path.extname(entry.name).toLowerCase();
        if (
          (fileType.toLowerCase().includes('tiff') || fileType.toLowerCase().includes('bitmap') || /\.tiff?$/i.test(entry.name)) &&
          !(ext === '.jpg' || ext === '.jpeg')
        ) {
          needsConversion = true;
          finalExtension = '.jpg';
          console.log(`TIFF/BMP detected: ${entry.name} -> will convert to JPEG`);
        }
      } catch (err) {
        console.warn(`Could not check file type for ${entry.name}:`, err.message);
      }

      let basename = path.parse(entry.name).name;
      let dest = path.join(extractDir, `${basename}${finalExtension}`);
      let i = 1;
      while (fs.existsSync(dest)) {
        dest = path.join(extractDir, `${basename}_${i++}${finalExtension}`);
      }

      if (needsConversion) {
        try {
          console.log(`Converting ${entry.name} to JPEG...`);
          await execAsync(`convert "${fullPath}" -quality 90 "${dest}"`);

          fs.unlinkSync(fullPath);
          console.log(`Successfully converted and moved: ${entry.name} -> ${path.basename(dest)}`);
        } catch (convertErr) {
          console.error(`Failed to convert ${entry.name}:`, convertErr.message);
          try {
            fs.renameSync(fullPath, dest);
            console.log(`Moved original file without conversion: ${entry.name}`);
          } catch (moveErr) {
            console.error(`Failed to move ${entry.name}:`, moveErr.message);
          }
        }
      } else {
        fs.renameSync(fullPath, dest);
        console.log(`Moved: ${entry.name} -> ${path.basename(dest)}`);
      }

    } else if (/\.(xml|txt|nfo|info)$/i.test(entry.name)) {
      fs.unlinkSync(fullPath);
      console.log(`Fichier supprimé: ${entry.name}`);
    }
  }
}

export async function extractArchive(tmpPath, extractDir) {
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
  }

  const { stdout: fileTypeOutput } = await execAsync(`file -b "${tmpPath}"`);
  const isZip = fileTypeOutput.toLowerCase().includes("zip archive");
  const isRar = fileTypeOutput.toLowerCase().includes("rar archive");
  
  let extractCommand = null;
  if (isZip) {
    extractCommand = `unzip -qq "${tmpPath}" -d "${extractDir}"`;
  } else if (isRar) {
    extractCommand = `unrar x -y "${tmpPath}" "${extractDir}"`;
  } else {
    throw new Error("Format non supporté: " + fileTypeOutput);
  }

  console.log(`Extraction avec: ${extractCommand}`);
  await execAsync(extractCommand);

  console.log(`Extraction terminée dans: ${extractDir}`);
}