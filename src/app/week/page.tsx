import type { Metadata } from "next";
import WeekView from "@/components/WeekView";

export const metadata: Metadata = {
  title: "This week in tech | Context Layer",
  description: "Three changes in tech this week, what changed and who each one affects, with every claim linked to its source passage.",
  openGraph: { title: "This week in tech", description: "Three changes, who they affect, every claim sourced.", type: "article" },
};

export default function Page() { return <WeekView />; }
