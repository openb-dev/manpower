const TARGET_BYTES = 1.6 * 1024 * 1024;
const HARD_MAX_INPUT = 25 * 1024 * 1024;

function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that picture."));
    img.src = url;
  });
}

async function loadImage(file: Blob) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that picture."));
      img.src = canvas.toDataURL("image/jpeg", 0.92);
    });
    return img;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await loadImageFromUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function drawJpeg(img: HTMLImageElement, maxEdge: number, quality: number) {
  let width = img.width || 1;
  let height = img.height || 1;
  if (width > maxEdge || height > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not compress the picture.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressImageBlob(file: Blob) {
  const img = await loadImage(file);
  const edges = [1600, 1280, 1100, 960, 800, 640];
  const qualities = [0.72, 0.62, 0.52, 0.42, 0.34, 0.26];
  let best = drawJpeg(img, edges[0], qualities[0]);
  if (dataUrlBytes(best) <= TARGET_BYTES) return best;
  for (const edge of edges) {
    for (const quality of qualities) {
      const next = drawJpeg(img, edge, quality);
      if (dataUrlBytes(next) < dataUrlBytes(best)) best = next;
      if (dataUrlBytes(best) <= TARGET_BYTES) return best;
    }
  }
  return best;
}

function extractLargestJpeg(bytes: Uint8Array) {
  let best: Uint8Array | null = null;
  for (let i = 0; i < bytes.length - 1; i += 1) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8) continue;
    for (let j = i + 2; j < bytes.length - 1; j += 1) {
      if (bytes[j] !== 0xff || bytes[j + 1] !== 0xd9) continue;
      const slice = bytes.subarray(i, j + 2);
      if (!best || slice.length > best.length) best = slice;
      i = j + 1;
      break;
    }
  }
  return best && best.length > 20_000 ? best : null;
}

function jpegFileName(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

export async function fileToCompressedUpload(file: File) {
  if (file.size > HARD_MAX_INPUT) {
    throw new Error("That file is too large to compress. Please choose a file under 25 MB.");
  }

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);

  if (isImage) {
    const dataUrl = await compressImageBlob(file);
    return { dataUrl, fileName: jpegFileName(file.name) };
  }

  if (isPdf) {
    if (file.size <= TARGET_BYTES) {
      return { dataUrl: await readAsDataUrl(file), fileName: file.name };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = extractLargestJpeg(bytes);
    if (jpeg) {
      const blob = new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
      const dataUrl = await compressImageBlob(blob);
      return { dataUrl, fileName: jpegFileName(file.name) };
    }
    if (file.size <= 8 * 1024 * 1024) {
      return { dataUrl: await readAsDataUrl(file), fileName: file.name };
    }
    throw new Error("Could not compress that PDF. Please upload a photo of the document.");
  }

  if (file.size <= TARGET_BYTES) {
    return { dataUrl: await readAsDataUrl(file), fileName: file.name };
  }
  throw new Error("Please upload a photo or PDF of the document.");
}
