import Link from "next/link";
import { ArrowRight, BookOpen, Check, CheckCircle2, ClipboardList, FileText, LockKeyhole, Sparkles, Stethoscope } from "lucide-react";
import { Brand } from "@/components/brand";
import { Disclaimer } from "@/components/disclaimer";

export default function Home() {
  return <>
    <header className="site-header"><div className="container header-inner">
      <Brand /><nav className="nav-links" aria-label="Main navigation"><a href="#features">Why MedCode AI</a><a href="#how-it-works">How it works</a><a href="#responsible-use">Responsible use</a></nav>
      <div className="nav-actions"><Link href="/login" className="text-link">Sign in</Link><Link href="/register" className="button primary small">Get started <ArrowRight size={15} /></Link></div>
    </div></header>
    <main id="main-content">
      <section className="hero"><div className="container hero-grid">
        <div><span className="eyebrow"><span className="dot" /> Built for clinical understanding</span>
          <h1>Bill accurately.<br />Document confidently.<br /><span>Understand why.</span></h1>
          <p className="hero-copy">A clearer connection between clinical documentation and medical decision-making. A learning space for hospitalists, using fictional or fully de-identified clinical notes.</p>
          <div className="hero-actions"><Link className="button primary" href="/register">Create your free account <ArrowRight size={17} /></Link><a className="button secondary" href="#how-it-works">Explore the workflow</a></div>
          <p className="hero-note"><LockKeyhole size={14} /> Educational portfolio demo · No identifying patient information</p>
        </div>
        <div className="preview" aria-label="Illustrative preview of the future analysis workspace">
          <div className="preview-bar"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span>THE LEARNING WORKSPACE</span><Sparkles size={15} /></div>
          <div className="preview-body"><span className="example-badge">ILLUSTRATIVE WORKSPACE PREVIEW</span><h3>From documentation to understanding.</h3>
            <div className="mock-note"><span className="label">Synthetic case excerpt</span><p>A fictional patient is evaluated during a hospital follow-up. The note describes the problems addressed, data reviewed, and management decisions.</p></div>
            <div className="preview-result"><span className="label">A guided review</span><strong>Explore the reasoning behind the documentation</strong><p>Review source evidence, MDM conclusions, potentially supported CPT codes, and documentation questions.</p></div>
          </div><div className="preview-footer"><CheckCircle2 size={14} /> Sign in to analyze a synthetic case or run a prepared example.</div>
        </div>
      </div></section>
      <div className="trust-strip"><div className="container trust-items"><span><Stethoscope size={17} /> Designed for hospitalist learning</span><span><BookOpen size={17} /> Education at every step</span><span><CheckCircle2 size={17} /> Synthetic cases, thoughtful practice</span></div></div>
      <section className="section" id="features"><div className="container"><div className="section-heading"><span className="eyebrow">Clarity beyond the code</span><h2>Build confidence in the “why.”</h2><p>Practice connecting the clinical story to the decisions behind it, with evidence and uncertainty made visible.</p></div>
        <div className="feature-grid">{[
          { icon: FileText, title: "Understand your documentation", text: "Explore how a fictional or fully de-identified note communicates the problems addressed and the care provided." },
          { icon: ClipboardList, title: "Make sense of MDM", text: "Learn how documented problems, data, and management risk contribute to decision-making complexity." },
          { icon: BookOpen, title: "Learn from the reasoning", text: "Review potentially supported CPT codes alongside educational explanations and documentation gaps." },
        ].map(({ icon: Icon, title, text }) => <article key={title} className="feature-card"><div className="feature-icon"><Icon size={23} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </div></section>
      <section className="section soft-section" id="how-it-works"><div className="container"><div className="section-heading"><span className="eyebrow">How it works</span><h2>Less guesswork. More understanding.</h2></div>
        <div className="steps"><article className="step"><span className="step-number">01 / GET STARTED</span><h3>Create your learning space</h3><p>Register and sign in to your personal dashboard. Your saved assessments belong to your account.</p></article><article className="step"><span className="step-number">02 / EXPLORE</span><h3>Work through a clinical teaching case</h3><p>Choose Admission H&P or Progress Note, then paste a fictional or fully de-identified note, enter sections, or import DOCX or TXT for review.</p></article><article className="step"><span className="step-number">03 / REFLECT</span><h3>Review and learn</h3><p>Compare documented facts, clinical interpretations, coding-rule conclusions, and uncertainties. Revisit the complete result in History.</p></article></div>
      </div></section>
      <section className="section responsible-use-section" id="responsible-use" aria-labelledby="responsible-use-heading"><div className="container">
        <div className="section-heading"><span className="eyebrow">Responsible use</span><h2 id="responsible-use-heading">A learning space with clear boundaries.</h2><p>Practice thoughtfully. Use fictional or fully de-identified material and understand the limits of this educational demo.</p></div>
        <div className="feature-grid">
          <article className="feature-card"><h3>Exclude identifying patient information</h3><p>Use invented cases or notes fully de-identified before entering this app. Removing names alone is insufficient. Automated screening cannot verify de-identification.</p></article>
          <article className="feature-card"><h3>Keep it educational</h3><p>Use this demo to explore concepts. Do not use it to make patient care decisions, submit claims, or determine actual billing codes.</p></article>
          <article className="feature-card"><h3>Understand the limits</h3><p>This application is not HIPAA-compliant. AI explanations, when available, may be incomplete or incorrect and require independent review.</p></article>
        </div>
        <div className="mt-7"><Disclaimer /></div>
      </div></section>
    </main>
    <footer className="site-footer"><div className="container footer-inner"><Brand /><p>© {new Date().getFullYear()} MedCode AI · A portfolio project. Built for learning.</p><Link className="text-link text-sm" href="/register">Start learning <Check size={14} className="inline" /></Link></div></footer>
  </>;
}
