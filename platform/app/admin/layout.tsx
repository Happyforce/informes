import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getUser, isAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/sin-acceso");

  return (
    <>
      <Nav label="Administración · Customer Advisory" />
      <main className="admin-main">{children}</main>
      <Footer />
    </>
  );
}
