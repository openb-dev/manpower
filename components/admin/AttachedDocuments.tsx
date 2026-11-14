"use client";

import React, { useMemo, useState } from "react";
import {
  documentTypeLabel,
  documentsForDownload,
  downloadAttachedFile,
  openAttachedFile,
  type AttachedDocument,
} from "@/lib/applicantFormFields";

function isImage(doc: AttachedDocument) {
  return (
    doc.src.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(doc.fileName)
  );
}

function isPdf(doc: AttachedDocument) {
  return doc.src.startsWith("data:application/pdf") || /\.pdf$/i.test(doc.fileName);
}

export default function AttachedDocuments({
  person,
  title = "Attached documents",
}: {
  person: any;
  title?: string;
}) {
  const documents = useMemo(() => documentsForDownload(person), [person]);
  const [viewing, setViewing] = useState<AttachedDocument | null>(null);

  if (!documents.length) {
    return (
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">{title}</h3>
        <p className="text-xs text-slate-400 italic">No document attachments uploaded.</p>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
        <button
          type="button"
          onClick={() => {
            documents.forEach((doc, index) => {
              window.setTimeout(() => downloadAttachedFile(doc.src, doc.downloadName || doc.fileName), index * 400);
            });
          }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg"
        >
          Download all
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc, idx) => (
          <div key={`${doc.docType}-${idx}`} className="border border-slate-200 rounded-lg p-3 bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {documentTypeLabel(doc.docType)}
            </div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5 break-all">{doc.downloadName || doc.fileName}</div>
            {isImage(doc) ? (
              <img
                src={doc.src}
                alt={doc.fileName}
                className="mt-2 max-h-36 w-full rounded border border-slate-200 object-contain bg-slate-50"
              />
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">
                {isPdf(doc) ? "PDF file" : "Document file"}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewing(doc)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => downloadAttachedFile(doc.src, doc.downloadName || doc.fileName)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewing ? (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {documentTypeLabel(viewing.docType)}
                </div>
                <div className="text-sm font-bold text-slate-900 break-all">{viewing.downloadName || viewing.fileName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadAttachedFile(viewing.src, viewing.downloadName || viewing.fileName)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => openAttachedFile(viewing.src)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-3 min-h-[50vh]">
              {isImage(viewing) ? (
                <img src={viewing.src} alt={viewing.fileName} className="max-w-full mx-auto rounded bg-white" />
              ) : isPdf(viewing) ? (
                <iframe title={viewing.fileName} src={viewing.src} className="w-full h-[70vh] rounded bg-white" />
              ) : (
                <div className="p-6 text-sm text-slate-600">
                  This file cannot be previewed here. Use Download or Open.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
