"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PwaRegister({ showButton = false }: { showButton?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Pick up new SW immediately after deploy
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    if (isStandaloneApp()) return;

    const iosDevice = isIosDevice();
    setIos(iosDevice);
    if (showButton || iosDevice) setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function installApp() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
      return;
    }
    if (ios) {
      alert(
        "To install this app on iPhone/iPad:\n\n1. Tap Share (square with an arrow)\n2. Tap Add to Home Screen\n3. Tap Add",
      );
      return;
    }
    alert("To install this app, open the browser menu and choose Install app or Add to Home Screen.");
  }

  if (!showButton || !visible) return null;

  return (
    <button
      type="button"
      onClick={installApp}
      className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-semibold"
    >
      Install app on this device
    </button>
  );
}
