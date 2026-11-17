import {
  applicationDisplayId,
  documentTypeLabel,
  personFilePrefix,
  type AttachedDocument,
} from "@/lib/applicantFormFields";

const A4 = { width: 595.28, height: 841.89 };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function srcToBytes(src: string) {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    const b64 = comma >= 0 ? src.slice(comma + 1) : src;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error("A document file could not be read.");
  return new Uint8Array(await res.arrayBuffer());
}

function looksLikePdf(doc: AttachedDocument, bytes?: Uint8Array) {
  if (bytes && bytes.length >= 4) {
    const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (head === "%PDF") return true;
  }
  return (
    doc.src.startsWith("data:application/pdf") ||
    /\.pdf$/i.test(doc.fileName) ||
    /\.pdf$/i.test(doc.downloadName || "")
  );
}

async function imageToJpegBytes(src: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.naturalWidth || img.width);
  canvas.height = Math.max(1, img.naturalHeight || img.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The picture could not be read.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return srcToBytes(dataUrl);
}

export function attachedDocumentsPackFileName(person: any) {
  return `${personFilePrefix(person)}_Documents.pdf`;
}

export async function downloadAttachedDocumentsPdf(person: any, documents: AttachedDocument[]) {
  if (!documents.length) throw new Error("No documents are attached.");

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.TimesRoman);
  const fontBold = await out.embedFont(StandardFonts.TimesRomanBold);

  const id = applicationDisplayId(person) || String(person?.employeeCode || "").trim();
  const name = String(person?.fullName || person?.formData?.name || "").trim();

  function drawHeader(page: any, title: string) {
    const { width, height } = page.getSize();
    page.drawText(title, {
      x: 36,
      y: height - 36,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    const sub = [id, name].filter(Boolean).join("  ·  ");
    if (sub) {
      page.drawText(sub, {
        x: 36,
        y: height - 54,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    page.drawLine({
      start: { x: 36, y: height - 64 },
      end: { x: width - 36, y: height - 64 },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  }

  async function addImagePage(doc: AttachedDocument) {
    const jpeg = await imageToJpegBytes(doc.src);
    const image = await out.embedJpg(jpeg);
    const page = out.addPage([A4.width, A4.height]);
    drawHeader(page, documentTypeLabel(doc.docType));
    const margin = 36;
    const top = 76;
    const maxW = A4.width - margin * 2;
    const maxH = A4.height - top - margin;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: margin + (maxW - w) / 2,
      y: margin + (maxH - h) / 2,
      width: w,
      height: h,
    });
  }

  async function addPdfPages(bytes: Uint8Array, title: string) {
    const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const cover = out.addPage([A4.width, A4.height]);
    drawHeader(cover, title);
    cover.drawText("Original document pages follow.", {
      x: 36,
      y: A4.height - 96,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    const copied = await out.copyPages(srcPdf, srcPdf.getPageIndices());
    copied.forEach((page) => out.addPage(page));
  }

  let added = 0;
  for (const doc of documents) {
    try {
      const bytes = await srcToBytes(doc.src);
      if (looksLikePdf(doc, bytes)) {
        try {
          await addPdfPages(bytes, documentTypeLabel(doc.docType));
          added += 1;
          continue;
        } catch {
          /* some scans are stored as PDF name but are pictures */
        }
      }
      await addImagePage(doc);
      added += 1;
    } catch {
      /* skip a bad file and keep packing the rest */
    }
  }

  if (!added) throw new Error("The documents could not be packed into one PDF.");

  const packed = await out.save();
  const copy = new Uint8Array(packed);
  saveBlob(new Blob([copy], { type: "application/pdf" }), attachedDocumentsPackFileName(person));
}
