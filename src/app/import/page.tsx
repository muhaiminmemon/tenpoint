import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImportWizard from "@/components/ImportWizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="display mb-6 text-2xl">Import your diary</h1>
      <ImportWizard />
    </div>
  );
}
