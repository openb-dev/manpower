function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function paperFormFileName(person: any, index = 0) {
  const raw = String(person?.fullName || "applicant").trim();
  const safe = raw.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "applicant";
  const suffix = String(person?.id || index).slice(-4);
  return `Applicant-form-${safe}-${suffix}.pdf`;
}

export async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

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

export async function downloadPaperFormPdf(root: HTMLElement, filename: string) {
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const jsPDF = jspdfMod.jsPDF ?? (jspdfMod as { default?: typeof jspdfMod.jsPDF }).default;
  if (!jsPDF) throw new Error("PDF library did not load.");

  const pack = root.querySelector(".paper-form-pack") || root;
  const pages = Array.from(pack.querySelectorAll<HTMLElement>(".paper-form-page"));
  const targets = pages.length ? pages : [pack as HTMLElement];

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const pageHeight = 297;

  for (let i = 0; i < targets.length; i += 1) {
    const canvas = await html2canvas(targets[i], {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
      onclone(_doc, cloned) {
        cloned.style.letterSpacing = "0px";
        cloned.style.wordSpacing = "0.16em";
        cloned.style.fontFamily = "Arial, Helvetica, sans-serif";
        cloned.querySelectorAll<HTMLElement>("*").forEach((el) => {
          el.style.letterSpacing = "0px";
          el.style.wordBreak = "normal";
          el.style.overflowWrap = "break-word";
          el.style.fontFamily = "Arial, Helvetica, sans-serif";
        });
      },
    });
    const img = canvas.toDataURL("image/jpeg", 0.9);
    let drawWidth = pageWidth;
    let drawHeight = (canvas.height * pageWidth) / canvas.width;
    if (drawHeight > pageHeight) {
      drawWidth = (canvas.width * pageHeight) / canvas.height;
      drawHeight = pageHeight;
    }
    if (i > 0) pdf.addPage();
    const x = (pageWidth - drawWidth) / 2;
    const y = 0;
    pdf.addImage(img, "JPEG", x, y, drawWidth, drawHeight);
  }

  saveBlob(pdf.output("blob"), filename);
  await sleep(400);
}
