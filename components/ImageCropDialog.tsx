"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

type ImageCropDialogProps = {
  src: string;
  title?: string;
  hint?: string;
  aspect?: number;
  fit?: "cover" | "contain";
  allowUseFull?: boolean;
  onCancel: () => void;
  onCrop: (file: File) => void;
  onUseFull?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPan(pan: Point, scale: number, nw: number, nh: number, cropW: number, cropH: number) {
  const w = nw * scale;
  const h = nh * scale;
  const minX = Math.min(0, cropW - w);
  const maxX = Math.max(0, cropW - w);
  const minY = Math.min(0, cropH - h);
  const maxY = Math.max(0, cropH - h);
  return {
    x: clamp(pan.x, minX, maxX),
    y: clamp(pan.y, minY, maxY),
  };
}

export default function ImageCropDialog({
  src,
  title = "Crop photo",
  hint = "Pinch to zoom. Drag to move. Then tap Crop & use.",
  aspect = 0,
  fit = "contain",
  allowUseFull = false,
  onCancel,
  onCrop,
  onUseFull,
}: ImageCropDialogProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef({ dist: 0, scale: 1, pan: { x: 0, y: 0 } });
  const drag = useRef({ x: 0, y: 0, pan: { x: 0, y: 0 } });

  const [natural, setNatural] = useState<Point | null>(null);
  const [frame, setFrame] = useState({ w: 280, h: 360 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [boxAspect, setBoxAspect] = useState(aspect > 0 ? aspect : 3 / 4);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (aspect > 0) {
      setBoxAspect(aspect);
      return;
    }
    if (!natural) return;
    setBoxAspect(clamp(natural.x / natural.y, 0.58, 1.78));
  }, [aspect, natural]);

  useEffect(() => {
    const box = frameRef.current;
    if (!box) return;
    const measure = () => {
      const rect = box.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setFrame({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [boxAspect]);

  useEffect(() => {
    if (!natural) return;
    const contain = Math.min(frame.w / natural.x, frame.h / natural.y);
    const cover = Math.max(frame.w / natural.x, frame.h / natural.y);
    const start = fit === "cover" ? cover : contain;
    setMinScale(contain);
    setScale(start);
    setPan(
      clampPan(
        { x: (frame.w - natural.x * start) / 2, y: (frame.h - natural.y * start) / 2 },
        start,
        natural.x,
        natural.y,
        frame.w,
        frame.h,
      ),
    );
  }, [natural, frame.w, frame.h, fit]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) {
      setLoadError("Could not read that picture. Please try another photo.");
      return;
    }
    setLoadError("");
    setNatural({ x: w, y: h });
  }

  function clientPoint(event: React.PointerEvent): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
  }

  function onPointerDown(event: React.PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const point = clientPoint(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      drag.current = { x: point.x, y: point.y, pan: { ...pan } };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: distance(a, b), scale, pan: { ...pan } };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId) || !natural) return;
    pointers.current.set(event.pointerId, clientPoint(event));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = distance(a, b);
      if (pinch.current.dist < 8) return;
      const nextScale = clamp(pinch.current.scale * (dist / pinch.current.dist), minScale, minScale * 6);
      const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ratio = nextScale / pinch.current.scale;
      const nextPan = clampPan(
        {
          x: origin.x - (origin.x - pinch.current.pan.x) * ratio,
          y: origin.y - (origin.y - pinch.current.pan.y) * ratio,
        },
        nextScale,
        natural.x,
        natural.y,
        frame.w,
        frame.h,
      );
      setScale(nextScale);
      setPan(nextPan);
      return;
    }
    if (pointers.current.size === 1) {
      const point = clientPoint(event);
      setPan(
        clampPan(
          {
            x: drag.current.pan.x + (point.x - drag.current.x),
            y: drag.current.pan.y + (point.y - drag.current.y),
          },
          scale,
          natural.x,
          natural.y,
          frame.w,
          frame.h,
        ),
      );
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 1) {
      const [left] = [...pointers.current.values()];
      drag.current = { x: left.x, y: left.y, pan: { ...pan } };
    }
  }

  function onWheel(event: React.WheelEvent) {
    if (!natural) return;
    event.preventDefault();
    const rect = frameRef.current?.getBoundingClientRect();
    const origin = { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
    const nextScale = clamp(scale * (event.deltaY > 0 ? 0.92 : 1.08), minScale, minScale * 6);
    const ratio = nextScale / scale;
    setScale(nextScale);
    setPan(
      clampPan(
        {
          x: origin.x - (origin.x - pan.x) * ratio,
          y: origin.y - (origin.y - pan.y) * ratio,
        },
        nextScale,
        natural.x,
        natural.y,
        frame.w,
        frame.h,
      ),
    );
  }

  async function confirmCrop() {
    const img = imgRef.current;
    if (!img || !natural || saving) return;
    setSaving(true);
    try {
      const sx = clamp(-pan.x / scale, 0, natural.x);
      const sy = clamp(-pan.y / scale, 0, natural.y);
      const sw = Math.min(natural.x - sx, frame.w / scale);
      const sh = Math.min(natural.y - sy, frame.h / scale);
      const longEdge = fit === "cover" ? (boxAspect < 1 ? 800 : 1200) : 1600;
      const srcLong = Math.max(sw, sh);
      const outScale = Math.min(1, longEdge / Math.max(srcLong, 1));
      const outW = Math.max(1, Math.round(sw * outScale));
      const outH = Math.max(1, Math.round(sh * outScale));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not crop the picture.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (next) => (next ? resolve(next) : reject(new Error("Could not crop the picture."))),
          "image/jpeg",
          0.92,
        );
      });
      onCrop(new File([blob], "cropped-photo.jpg", { type: "image/jpeg" }));
    } catch (err: any) {
      setLoadError(err?.message || "Could not crop the picture.");
      setSaving(false);
    }
  }

  const frameMaxW = fit === "cover" ? "min(86vw, 22rem)" : "min(92vw, 26rem)";

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 text-white flex flex-col">
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-white/80 mt-1">{hint}</p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div
          className="relative bg-white overflow-hidden touch-none select-none shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          style={{ width: frameMaxW, aspectRatio: String(boxAspect), maxHeight: "70vh" }}
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Crop"
            draggable={false}
            onLoad={onImageLoad}
            onError={() => setLoadError("Could not read that picture. Please try another photo.")}
            className="absolute max-w-none pointer-events-none"
            style={{
              width: natural ? `${natural.x * scale}px` : "100%",
              height: natural ? `${natural.y * scale}px` : "auto",
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          />
          <div className="absolute inset-0 border-2 border-white/90 pointer-events-none" />
        </div>
      </div>
      {loadError ? <p className="px-4 text-xs text-red-200 font-semibold">{loadError}</p> : null}
      <div className={`grid gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${allowUseFull && onUseFull ? "grid-cols-3" : "grid-cols-2"}`}>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-xl border border-white/30 text-sm font-bold"
        >
          Cancel
        </button>
        {allowUseFull && onUseFull ? (
          <button
            type="button"
            disabled={saving}
            onClick={onUseFull}
            className="min-h-12 rounded-xl border border-white/40 bg-white/10 text-sm font-bold disabled:opacity-50"
          >
            Use full picture
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || !natural || Boolean(loadError)}
          onClick={confirmCrop}
          className="min-h-12 rounded-xl bg-blue-600 text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Crop & use"}
        </button>
      </div>
    </div>
  );
}
