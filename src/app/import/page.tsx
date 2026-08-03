import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImportWizard from "@/components/ImportWizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await getSessionUser();
  // Somebody who lands on import without an account is arriving, not
  // returning: sending them to the sign-in form asks for a password they have
  // never set. Signup already carries `next` and lands them back here.
  if (!user) redirect("/signup?next=/import");

  return (
    <div>
      <h1 className="display mb-6 text-2xl">Import your diary</h1>
      <ImportWizard />
    </div>
  );
}
