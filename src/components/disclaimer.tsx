import { ShieldCheck } from "lucide-react";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <aside className={compact ? "disclaimer compact" : "disclaimer"} aria-label="Synthetic data policy">
    <ShieldCheck size={22} aria-hidden="true" />
    <div><strong>Synthetic data only.</strong> This portfolio demonstration is for education.
      {!compact && " Do not enter real patient information. MedCode AI is not HIPAA-compliant and does not provide clinical, coding, or billing advice."}
    </div>
  </aside>;
}
