import { RequireAuth } from "@/components/shared/require-auth";
import { Header } from "@/components/shared/header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </RequireAuth>
  );
}
