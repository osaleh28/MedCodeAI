import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Disclaimer } from "@/components/disclaimer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <><header className="site-header"><div className="container header-inner"><Brand /><span className="label">Your clinical learning space</span></div></header>
    <main id="main-content" className="auth-shell"><aside className="auth-aside"><span className="eyebrow">A clearer way to learn</span><h2>Confidence starts with understanding.</h2><p>Build a stronger connection between documentation, decision-making, and billing education.</p><ul><li><CheckCircle2 size={18} /> A personal learning dashboard</li><li><CheckCircle2 size={18} /> Practice with synthetic cases only</li><li><CheckCircle2 size={18} /> Evidence, MDM explanations, and saved history</li></ul></aside><section className="auth-panel"><div className="auth-panel-inner">{children}</div></section></main>
    <div className="container safety-section"><Disclaimer /></div></>;
}
