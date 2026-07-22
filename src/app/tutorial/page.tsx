import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "دليل استخدام النظام",
};

export default function TutorialPage() {
  return (
    <iframe
      src="/tutorial/index.html"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
    />
  );
}
