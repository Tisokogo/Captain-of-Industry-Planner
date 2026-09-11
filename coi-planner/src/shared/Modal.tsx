import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, close);
  const titleId = `modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div
      className="modal-back"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2 id={titleId}>{title}</h2>
          <button onClick={close} aria-label={title === 'Close' ? title : `Close: ${title}`}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
