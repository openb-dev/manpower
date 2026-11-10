const TARGET_BYTES = 200 * 1024;
const HARD_MAX_INPUT = 40 * 1024 * 1024;

export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

async function loadSource(file: Blob) {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await loadImageFromUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

type ImageSource = HTMLImageElement | ImageBitmap;

function sourceSize(img: ImageSource) {
  if ("naturalWidth" in img && img.naturalWidth) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  return { width: img.width || 1, height: img.height || 1 };
}

function drawJpeg(img: ImageSource, maxEdge: number, quality: number) {
  const size = sourceSize(img);
  let width = size.width;
  let height = size.height;
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
  const img = await loadSource(file);
  const edges = [1600, 1280, 1100, 960, 800, 640, 480];
  const qualities = [0.7, 0.58, 0.48, 0.38, 0.3, 0.22];
  let best = drawJpeg(img, edges[0], qualities[0]);
  if (dataUrlBytes(best) <= TARGET_BYTES) {
    closeSource(img);
    return best;
  }
  for (const edge of edges) {
    for (const quality of qualities) {
      const next = drawJpeg(img, edge, quality);
      if (dataUrlBytes(next) < dataUrlBytes(best)) best = next;
      if (dataUrlBytes(best) <= TARGET_BYTES) {
        closeSource(img);
        return best;
      }
    }
  }
  closeSource(img);
  return best;
}

function closeSource(img: ImageSource) {
  if ("close" in img && typeof img.close === "function") img.close();
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

export function dataUrlToBlob(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function fileToCompressedUpload(file: File) {
  if (file.size > HARD_MAX_INPUT) {
    throw new Error("That file is too large to compress. Please choose a file under 40 MB.");
  }

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);

  if (isImage) {
    try {
      const dataUrl = await compressImageBlob(file);
      return { dataUrl, fileName: jpegFileName(file.name) };
    } catch {
      if (file.size <= TARGET_BYTES) {
        return { dataUrl: await readAsDataUrl(file), fileName: file.name };
      }
      throw new Error("Could not read that picture. Please upload a JPG or PNG photo.");
    }
  }

  if (isPdf) {
    if (file.size <= TARGET_BYTES) {
      return { dataUrl: await readAsDataUrl(file), fileName: file.name };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = extractLargestJpeg(bytes);
    if (jpeg) {
      const blob = new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
      try {
        const dataUrl = await compressImageBlob(blob);
        return { dataUrl, fileName: jpegFileName(file.name) };
      } catch {
        return { dataUrl: await readAsDataUrl(blob), fileName: jpegFileName(file.name) };
      }
    }
    if (file.size <= 2.5 * 1024 * 1024) {
      return { dataUrl: await readAsDataUrl(file), fileName: file.name };
    }
    throw new Error("That PDF is too heavy to compress. Please upload a photo of the document instead.");
  }

  if (file.size <= TARGET_BYTES) {
    return { dataUrl: await readAsDataUrl(file), fileName: file.name };
  }
  throw new Error("Please upload a photo or PDF of the document.");
}
