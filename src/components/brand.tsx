import Link from "next/link";
import { Activity } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="MedCode AI home">
    <span className="brand-icon"><Activity size={23} strokeWidth={2.4} /></span>
    <span>MedCode<span className="brand-ai"> AI</span></span>
  </Link>;
}
