import { ShieldCheck } from "lucide-react";
import { privacyNotice } from "@/lib/clinical/privacy";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <aside className={compact ? "disclaimer compact" : "disclaimer"} aria-label="Documentation privacy policy">
    <ShieldCheck size={22} aria-hidden="true" />
    <div><strong>{privacyNotice}</strong>
      {!compact && " Do not include identifying patient details. This app cannot certify de-identification, is not HIPAA-compliant, and has not been validated for clinical or billing use."}
    </div>
  </aside>;
}
