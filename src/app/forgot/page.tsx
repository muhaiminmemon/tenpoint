import ForgotForm from "@/components/ForgotForm";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-xl border border-seam bg-carbon p-7">
        <ForgotForm />
      </div>
    </div>
  );
}
