import { ShieldCheck } from "lucide-react";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <aside className={compact ? "disclaimer compact" : "disclaimer"} aria-label="Synthetic data policy">
    <ShieldCheck size={22} aria-hidden="true" />
    <div><strong>Portfolio demonstration only. Synthetic clinical data only. Not intended for patient care or actual billing decisions.</strong>
      {!compact && " Do not enter real patient information. MedCode AI is not HIPAA-compliant and has not been validated for clinical or billing use."}
    </div>
  </aside>;
}
