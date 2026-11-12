import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ProductIcon } from "./DriverExperience";
import { FocusPanel } from "./DriverExperience";
import "./operational.css";
import { useModal } from "./useModal";

/** One task group; rows share a surface and use dividers instead of cards. */
export function OperationalPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="operational-panel">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** One semantic table; reflows by available component width without duplicate controls. */
export function OperationalTable({
  title,
  headings,
  children,
}: {
  title: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="operational-table-container">
      <table className="operational-table" aria-label={title} role="table">
        <thead role="rowgroup">
          <tr role="row">
            {headings.map((label, index) => (
              <th key={index} scope="col" role="columnheader">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">{children}</tbody>
      </table>
    </div>
  );
}

export function OperationalCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <td data-label={label} role="cell">
      {children}
    </td>
  );
}

/** Native modal supplies focus containment, Escape and an inert background. */
export function DriverDialog({
  visible = true,
  ...props
}: Parameters<typeof FocusPanel>[0] & { visible?: boolean }) {
  const dialog = useModal(visible);
  return visible
    ? createPortal(
        <dialog
          ref={dialog}
          className="driver-dialog"
          aria-label={props.title}
          onCancel={(event) => {
            event.preventDefault();
            if (!props.busy) props.onClose();
          }}
        >
          <FocusPanel {...props} />
        </dialog>,
        document.body,
      )
    : null;
}

export function OperationalRow({
  icon,
  title,
  children,
  action,
  onClick,
  primary = false,
}: {
  icon: "route" | "people" | "message" | "payment";
  title: string;
  children: ReactNode;
  action: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <section
      className="operational-row"
      aria-label={`Resumen de ${title.toLowerCase()}`}
    >
      <ProductIcon name={icon} />
      <div className="operational-row-content">
        <h3>{title}</h3>
        {children}
      </div>
      {onClick && (
        <button
          type="button"
          className={`button ${primary ? "button-primary" : "button-link"}`}
          onClick={onClick}
        >
          {action}
        </button>
      )}
    </section>
  );
}
