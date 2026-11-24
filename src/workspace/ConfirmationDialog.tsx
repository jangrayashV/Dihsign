import { AlertTriangle, X } from 'lucide-react';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({ title, message, confirmLabel, onCancel, onConfirm }: Props) {
  return (
    <div className="confirmation-dialog-layer" role="presentation">
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <header>
          <span className="confirmation-icon"><AlertTriangle size={18} aria-hidden="true" /></span>
          <div><h2 id="confirmation-title">{title}</h2><p id="confirmation-message">{message}</p></div>
          <button type="button" aria-label="Close confirmation" onClick={onCancel}><X size={16} /></button>
        </header>
        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="danger" autoFocus onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
