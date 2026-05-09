import { notFound } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KanzenAI Control",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DashboardClient />;
}
