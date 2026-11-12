import { createContext, useContext, useEffect, useRef } from "react";

export const TaskVisibility = createContext(true);

let openLayers = 0;
let originalOverflow = "";

/** Native top layer, shared scroll lock and return focus, including nested readers. */
export function useModal(active = true, restoreFocus?: () => void) {
  const taskVisible = useContext(TaskVisibility);
  const visible = active && taskVisible;
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef(restoreFocus);
  restore.current = restoreFocus;
  useEffect(() => {
    if (!visible) return;
    const node = dialog.current;
    if (!node) return;
    const trigger = document.activeElement;
    if (openLayers++ === 0) originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", ""); // jsdom has no top-layer implementation.
    return () => {
      if (typeof node.close === "function") node.close();
      if (--openLayers === 0) document.body.style.overflow = originalOverflow;
      if (restore.current) restore.current();
      else if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [visible]);
  return dialog;
}
