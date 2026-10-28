import type { Metadata } from "next";
import { Disclaimer } from "@/components/disclaimer";
import { NewAnalysisForm } from "@/components/new-analysis-form";

export const metadata: Metadata = { title: "New analysis" };
export default function NewAnalysisPage() {
  return <><div className="dashboard-heading"><div><span className="eyebrow">Document. Understand. Learn.</span><h1>New analysis</h1><p>Explore what the original documentation supports, with evidence at each step.</p></div></div><Disclaimer /><NewAnalysisForm /></>;
}
