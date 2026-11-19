"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

type Point = { x: number; y: number };
type CropBox = { l: number; t: number; r: number; b: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

type ImageCropDialogProps = {
  src: string;
  title?: string;
  hint?: string;
  aspect?: number;
  fit?: "cover" | "contain";
  mode?: "photo" | "document";
  allowUseFull?: boolean;
  onCancel: () => void;
  onCrop: (file: File) => void;
  onUseFull?: () => void;
};

const MIN_CROP = 0.08;

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

function clampBox(box: CropBox): CropBox {
  const l = clamp(box.l, 0, box.r - MIN_CROP);
  const t = clamp(box.t, 0, box.b - MIN_CROP);
  const r = clamp(box.r, l + MIN_CROP, 1);
  const b = clamp(box.b, t + MIN_CROP, 1);
  return { l, t, r, b };
}

function applyHandle(box: CropBox, handle: Handle, x: number, y: number, start: CropBox, origin: Point): CropBox {
  const next = { ...box };
  if (handle === "move") {
    const w = start.r - start.l;
    const h = start.b - start.t;
    const dl = x - origin.x;
    const dt = y - origin.y;
    next.l = clamp(start.l + dl, 0, 1 - w);
    next.t = clamp(start.t + dt, 0, 1 - h);
    next.r = next.l + w;
    next.b = next.t + h;
    return clampBox(next);
  }
  if (handle.includes("w")) next.l = x;
  if (handle.includes("e")) next.r = x;
  if (handle.includes("n")) next.t = y;
  if (handle.includes("s")) next.b = y;
  if (next.l > next.r) {
    const swap = next.l;
    next.l = next.r;
    next.r = swap;
  }
  if (next.t > next.b) {
    const swap = next.t;
    next.t = next.b;
    next.b = swap;
  }
  return clampBox(next);
}

export default function ImageCropDialog({
  src,
  title = "Crop photo",
  hint,
  aspect = 0,
  fit = "contain",
  mode = "photo",
  allowUseFull = false,
  onCancel,
  onCrop,
  onUseFull,
}: ImageCropDialogProps) {
  const isDocument = mode === "document";
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef({ dist: 0, scale: 1, pan: { x: 0, y: 0 } });
  const drag = useRef({ x: 0, y: 0, pan: { x: 0, y: 0 } });
  const edgeDrag = useRef<{ handle: Handle; start: CropBox; origin: Point } | null>(null);

  const [natural, setNatural] = useState<Point | null>(null);
  const [frame, setFrame] = useState({ w: 280, h: 360 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [boxAspect, setBoxAspect] = useState(aspect > 0 ? aspect : 3 / 4);
  const [crop, setCrop] = useState<CropBox>({ l: 0.04, t: 0.04, r: 0.96, b: 0.96 });
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
    const img = imgRef.current;
    if (img?.complete && (img.naturalWidth || img.width)) onImageLoad();
  }, [src]);

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
    if (!box || isDocument) return;
    const measure = () => {
      const rect = box.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setFrame({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [boxAspect, isDocument]);

  useEffect(() => {
    if (!natural || isDocument) return;
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
  }, [natural, frame.w, frame.h, fit, isDocument]);

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
    setCrop({ l: 0.04, t: 0.04, r: 0.96, b: 0.96 });
  }

  function clientPoint(event: ReactPointerEvent): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
  }

  function normPoint(event: ReactPointerEvent): Point {
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function onPointerDown(event: ReactPointerEvent) {
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

  function onPointerMove(event: ReactPointerEvent) {
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

  function onPointerUp(event: ReactPointerEvent) {
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

  function onEdgeDown(handle: Handle, event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    edgeDrag.current = { handle, start: { ...crop }, origin: normPoint(event) };
  }

  function onEdgeMove(event: ReactPointerEvent) {
    if (!edgeDrag.current) return;
    const point = normPoint(event);
    setCrop(applyHandle(edgeDrag.current.start, edgeDrag.current.handle, point.x, point.y, edgeDrag.current.start, edgeDrag.current.origin));
  }

  function onEdgeUp() {
    edgeDrag.current = null;
  }

  async function confirmCrop() {
    const img = imgRef.current;
    if (!img || !natural || saving) return;
    setSaving(true);
    try {
      let sx: number;
      let sy: number;
      let sw: number;
      let sh: number;
      if (isDocument) {
        sx = crop.l * natural.x;
        sy = crop.t * natural.y;
        sw = Math.max(1, (crop.r - crop.l) * natural.x);
        sh = Math.max(1, (crop.b - crop.t) * natural.y);
      } else {
        sx = clamp(-pan.x / scale, 0, natural.x);
        sy = clamp(-pan.y / scale, 0, natural.y);
        sw = Math.min(natural.x - sx, frame.w / scale);
        sh = Math.min(natural.y - sy, frame.h / scale);
      }
      const longEdge = isDocument || fit !== "cover" ? 1600 : boxAspect < 1 ? 800 : 1200;
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
      onCrop(new File([blob], isDocument ? "cropped-document.jpg" : "cropped-photo.jpg", { type: "image/jpeg" }));
    } catch (err: any) {
      setLoadError(err?.message || "Could not crop the picture.");
      setSaving(false);
    }
  }

  const display = (() => {
    if (!natural) return { w: 280, h: 360 };
    const maxW = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.92 : 420, 520);
    const maxH = Math.min(typeof window !== "undefined" ? window.innerHeight * 0.58 : 420, 520);
    const ratio = Math.min(maxW / natural.x, maxH / natural.y);
    return { w: Math.max(160, natural.x * ratio), h: Math.max(160, natural.y * ratio) };
  })();

  const frameMaxW = fit === "cover" ? "min(86vw, 22rem)" : "min(92vw, 26rem)";
  const cropLeft = `${crop.l * 100}%`;
  const cropTop = `${crop.t * 100}%`;
  const cropWidth = `${(crop.r - crop.l) * 100}%`;
  const cropHeight = `${(crop.b - crop.t) * 100}%`;
  const handles: { id: Handle; style: CSSProperties; bar?: boolean }[] = [
    { id: "nw", style: { left: cropLeft, top: cropTop, transform: "translate(-50%, -50%)" } },
    { id: "ne", style: { left: `${crop.r * 100}%`, top: cropTop, transform: "translate(-50%, -50%)" } },
    { id: "sw", style: { left: cropLeft, top: `${crop.b * 100}%`, transform: "translate(-50%, -50%)" } },
    { id: "se", style: { left: `${crop.r * 100}%`, top: `${crop.b * 100}%`, transform: "translate(-50%, -50%)" } },
    { id: "n", style: { left: `${((crop.l + crop.r) / 2) * 100}%`, top: cropTop, transform: "translate(-50%, -50%)" }, bar: true },
    { id: "s", style: { left: `${((crop.l + crop.r) / 2) * 100}%`, top: `${crop.b * 100}%`, transform: "translate(-50%, -50%)" }, bar: true },
    { id: "w", style: { left: cropLeft, top: `${((crop.t + crop.b) / 2) * 100}%`, transform: "translate(-50%, -50%)" }, bar: true },
    { id: "e", style: { left: `${crop.r * 100}%`, top: `${((crop.t + crop.b) / 2) * 100}%`, transform: "translate(-50%, -50%)" }, bar: true },
  ];
  const cursorFor: Record<Handle, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
    move: "move",
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 text-white flex flex-col">
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-white/80 mt-1">
          {hint ||
            (isDocument
              ? "Drag the four sides or corners to cut extra edges. Then tap Crop & use."
              : "Pinch to zoom. Drag to move. Then tap Crop & use.")}
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        {isDocument ? (
          <div
            className="relative touch-none select-none"
            ref={imageBoxRef}
            style={{ width: display.w, height: display.h }}
            onPointerMove={onEdgeMove}
            onPointerUp={onEdgeUp}
            onPointerCancel={onEdgeUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Crop"
              draggable={false}
              onLoad={onImageLoad}
              onError={() => setLoadError("Could not read that picture. Please try another photo.")}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white"
            />
            <div className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none" style={{ height: cropTop }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none" style={{ height: `${(1 - crop.b) * 100}%` }} />
            <div
              className="absolute bg-black/50 pointer-events-none"
              style={{ left: 0, top: cropTop, width: cropLeft, height: cropHeight }}
            />
            <div
              className="absolute bg-black/50 pointer-events-none"
              style={{ left: `${crop.r * 100}%`, top: cropTop, width: `${(1 - crop.r) * 100}%`, height: cropHeight }}
            />
            <div
              className="absolute border-2 border-white"
              style={{ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight, cursor: "move" }}
              onPointerDown={(event) => onEdgeDown("move", event)}
              onPointerMove={onEdgeMove}
              onPointerUp={onEdgeUp}
              onPointerCancel={onEdgeUp}
            >
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/25" />
                ))}
              </div>
            </div>
            {handles.map((handle) => (
              <button
                key={handle.id}
                type="button"
                aria-label={`Crop ${handle.id}`}
                className={`absolute z-10 bg-white border-2 border-blue-500 shadow ${
                  handle.bar ? "rounded-sm" : "rounded-sm"
                }`}
                style={{
                  width: handle.bar && (handle.id === "n" || handle.id === "s") ? 36 : handle.bar ? 12 : 22,
                  height: handle.bar && (handle.id === "e" || handle.id === "w") ? 36 : handle.bar ? 12 : 22,
                  cursor: cursorFor[handle.id],
                  touchAction: "none",
                  ...handle.style,
                }}
                onPointerDown={(event) => onEdgeDown(handle.id, event)}
                onPointerMove={onEdgeMove}
                onPointerUp={onEdgeUp}
                onPointerCancel={onEdgeUp}
              />
            ))}
          </div>
        ) : (
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
        )}
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
