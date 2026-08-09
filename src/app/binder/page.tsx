import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loadBinder } from "@/lib/binder";
import { recordHeldVariants } from "@/lib/variant-history";
import BinderShowcase from "@/components/BinderShowcase";

export const metadata = { title: "Binder" };

export default async function BinderPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/binder");

  const binder = await loadBinder(user);
  // Owner-only route, so this is the right place to note the finishes in force.
  await recordHeldVariants(user.id, binder.heldVariantNames);

  return (
    <div>
      <header className="mb-12 max-w-[58ch]">
        <h1 className="display text-[32px] leading-none">Binder</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          Every finish your card can be dealt, and which of them are yours. Nothing here is
          chosen or bought. A finish arrives because of what you watched, and leaves the same
          way. The ones you don&apos;t hold are printed too.
        </p>
        {binder.rated === 0 && (
          <p className="mt-4 text-[15px] leading-relaxed text-paper">
            Nothing is yours yet. Rate a film and the first tier is issued;{" "}
            <Link href="/import" className="text-beam underline underline-offset-4">
              importing an existing diary
            </Link>{" "}
            is the fastest way there.
          </p>
        )}
      </header>

      <BinderShowcase binder={binder} />
    </div>
  );
}
