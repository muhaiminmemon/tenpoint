import VerifyConfirm from "@/components/VerifyConfirm";

export const metadata = { title: "Confirm your email" };

export default async function VerifyPage(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-xl border border-seam bg-carbon p-7">
        <VerifyConfirm token={token} />
      </div>
    </div>
  );
}
