import ResetForm from "@/components/ResetForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-xl border border-seam bg-carbon p-7">
        {/* The token is only checked when the form is submitted: validating it
            here would mean a mail scanner's GET could tell us it was used. */}
        <ResetForm token={token} />
      </div>
    </div>
  );
}
