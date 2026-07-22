import { Tracker } from "@/components/Tracker";
import { site } from "@/lib/site";

export const metadata = {
  title: `Track your appointment — ${site.shortName}`,
};

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Tracker code={code} />;
}
