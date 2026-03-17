import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export default async function Home() {
  const user = await verifyToken();
  if (user) redirect("/dashboard");
  else redirect("/login");
}
