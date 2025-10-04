"use client";

import { Toaster } from "sonner";

export default function ClientToaster() {
  return (
    <Toaster
      richColors
      closeButton
      theme="system"        // follows OS theme
      position="top-right"  // matches dashboard UX
    />
  );
}