import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import privacy from "./legal/privacy.md?raw";
import terms from "./legal/terms.md?raw";
import "./legal-access.css";
import { StoragePrivacy } from "./StoragePrivacy";
import cookies from "./legal/cookies.md?raw";
import { useModal } from "./useModal";

const documents = {
  Privacidad: privacy,
  Términos: terms,
  "Cookies y almacenamiento": cookies,
};
type DocumentName = keyof typeof documents;

// Static public documents only. State belongs to the auth/account subtree.
export function LegalAccess() {
  const [selected, setSelected] = useState<DocumentName | null>(null);
  return (
    <div className="legal-access">
      <nav aria-label="Documentos legales">
        {(["Privacidad", "Términos", "Cookies y almacenamiento"] as const).map(
          (name, index) => (
            <span
              key={name}
              className={`legal-link-group${index === 2 ? " legal-storage-link" : ""}`}
            >
              {index === 1 && <span aria-hidden="true">·</span>}
              <button
                type="button"
                className="legal-link"
                onClick={() => setSelected(name)}
              >
                {name}
              </button>
            </span>
          ),
        )}
      </nav>
      {selected &&
        createPortal(
          <LegalDocument
            name={selected}
            onClose={() => setSelected(null)}
            onPrivacy={() => setSelected("Privacidad")}
          />,
          document.body,
        )}
    </div>
  );
}

function LegalDocument({
  name,
  onClose,
  onPrivacy,
}: {
  name: DocumentName;
  onClose: () => void;
  onPrivacy: () => void;
}) {
  const sectionId = useId();
  const blocks = documents[name]
    .trim()
    .split(/\n\s*\n/)
    .slice(1);
  const headings = blocks.flatMap((block, index) =>
    block.startsWith("## ") ? [{ title: block.slice(3), index }] : [],
  );
  const trigger = useRef(document.activeElement);
  const dialog = useModal(true, () => {
    const target = trigger.current;
    if (
      target instanceof HTMLElement &&
      target.isConnected &&
      (target.checkVisibility?.() ?? true)
    ) {
      target.focus({ preventScroll: true });
    } else {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    dialog.current?.scrollTo?.({ top: 0 });
  }, [name]);
  return (
    <dialog
      ref={dialog}
      className={
        name === "Cookies y almacenamiento"
          ? "legal-document storage-document"
          : "legal-document"
      }
      aria-labelledby="legal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="legal-document-header">
        <h1 id="legal-title" ref={heading} tabIndex={-1}>
          {name}
        </h1>
        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
        >
          Cerrar documento
        </button>
      </div>
      {name === "Cookies y almacenamiento" ? (
        <StoragePrivacy onPrivacy={onPrivacy} />
      ) : (
        <div className="legal-document-layout">
          <aside className="legal-toc">
            <details>
              <summary>Índice del documento</summary>
              <nav aria-label={`Secciones de ${name}`}>
                <a
                  href={`#${sectionId}-intro`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(`${sectionId}-intro`)?.focus();
                  }}
                >
                  Versión y advertencia de borrador
                </a>
                {headings.map(({ title, index }) => (
                  <a
                    key={index}
                    href={`#${sectionId}-${index}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(`${sectionId}-${index}`)?.focus();
                    }}
                  >
                    {title}
                  </a>
                ))}
              </nav>
            </details>
          </aside>
          <article aria-label={`Documento íntegro de ${name}`}>
            {blocks.map((block, index) =>
              block.startsWith("## ") ? (
                <h2 key={index} id={`${sectionId}-${index}`} tabIndex={-1}>
                  {block.slice(3)}
                </h2>
              ) : (
                <p
                  key={index}
                  id={index === 0 ? `${sectionId}-intro` : undefined}
                  tabIndex={index === 0 ? -1 : undefined}
                  className={index === 0 ? "legal-draft" : undefined}
                >
                  {block.replace(/\n/g, " ")}
                </p>
              ),
            )}
          </article>
        </div>
      )}
    </dialog>
  );
}
