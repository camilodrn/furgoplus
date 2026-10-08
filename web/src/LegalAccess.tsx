import { useEffect, useRef, useState } from "react";
import privacy from "./legal/privacy.md?raw";
import terms from "./legal/terms.md?raw";

const documents = { Privacidad: privacy, Términos: terms };
type DocumentName = keyof typeof documents;

// Static public documents only. State belongs to the auth/account subtree.
export function LegalAccess() {
  const [selected, setSelected] = useState<DocumentName | null>(null);
  return (
    <div className="legal-access">
      <nav aria-label="Documentos legales">
        {(["Privacidad", "Términos"] as const).map((name, index) => (
          <span key={name} className="legal-link-group">
            {index > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              className="legal-link"
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          </span>
        ))}
      </nav>
      {selected && (
        <LegalDocument name={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function LegalDocument({
  name,
  onClose,
}: {
  name: DocumentName;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    if (element) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    }
    heading.current?.focus();
    return () => {
      if (typeof element?.close === "function") element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="legal-document"
      aria-labelledby="legal-title"
      onCancel={onClose}
    >
      <div className="legal-document-header">
        <h1 id="legal-title" ref={heading} tabIndex={-1}>
          {name}
        </h1>
        <button type="button" className="button-outline" onClick={onClose}>
          Cerrar documento
        </button>
      </div>
      <article>
        {documents[name]
          .trim()
          .split(/\n\s*\n/)
          .slice(1)
          .map((block, index) =>
            block.startsWith("## ") ? (
              <h2 key={index}>{block.slice(3)}</h2>
            ) : (
              <p
                key={index}
                className={index === 0 ? "legal-draft" : undefined}
              >
                {block.replace(/\n/g, " ")}
              </p>
            ),
          )}
      </article>
    </dialog>
  );
}
