import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Notice = {
  kind: "error" | "success" | "warning";
  title: string;
  message?: string;
};
function useNoticeState() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const show = useCallback((next: Notice) => {
    if (!alive.current) return;
    setHovered(false);
    setFocused(false);
    setNotice(next);
  }, []);
  const clear = useCallback(() => setNotice(null), []);
  useEffect(() => {
    if (notice?.kind !== "success" || hovered || focused) return;
    const timer = window.setTimeout(clear, 8000);
    return () => window.clearTimeout(timer);
  }, [notice, hovered, focused, clear]);
  return { notice, show, clear, setHovered, setFocused };
}
type Feedback = ReturnType<typeof useNoticeState>;
const FeedbackContext = createContext<Feedback | null>(null);

// Must live inside the identity-keyed workspace, never in storage or the auth shell.
export function ActionFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { notice, show, clear, setHovered, setFocused } = useNoticeState();
  const value = useMemo(
    () => ({ notice, show, clear, setHovered, setFocused }),
    [notice, show, clear, setHovered, setFocused],
  );
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ActionNotice feedback={value} />
    </FeedbackContext.Provider>
  );
}
export function useActionFeedback() {
  const shared = useContext(FeedbackContext);
  const local = useNoticeState();
  return { ...(shared ?? local), local: shared ? null : local };
}
export function ActionNotice({ feedback }: { feedback: Feedback | null }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  if (!feedback?.notice) return null;
  const { notice, clear, setHovered, setFocused } = feedback;
  return createPortal(
    <aside
      className="viewport-action-notice"
      aria-label="Aviso de la acción"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        setFocused(true);
        if (!event.currentTarget.contains(event.relatedTarget))
          returnFocus.current =
            event.relatedTarget instanceof HTMLElement
              ? event.relatedTarget
              : null;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div
        className={`viewport-notice-card notice-${notice.kind}`}
        role={notice.kind === "success" ? "status" : "alert"}
        aria-live={notice.kind === "success" ? "polite" : "assertive"}
        aria-atomic="true"
      >
        <span className="notice-marker" aria-hidden="true">
          {notice.kind === "success" ? "✓" : "!"}
        </span>
        <div className="notice-copy">
          <strong>{notice.title}</strong>
          {notice.message && <p>{notice.message}</p>}
        </div>
      </div>
      <button
        type="button"
        className="notice-dismiss button-outline"
        aria-label="Cerrar aviso"
        onClick={(event) => {
          const restore = event.currentTarget === document.activeElement;
          clear();
          if (restore && returnFocus.current?.isConnected)
            returnFocus.current.focus({ preventScroll: true });
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>,
    document.body,
  );
}
