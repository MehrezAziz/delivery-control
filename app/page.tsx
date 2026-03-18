import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export default async function Home() {
  const user = await verifyToken();
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/dashboard");
  if (user.role === "CUSTOMER_SERVICE") redirect("/cs");
  redirect("/login");
}
