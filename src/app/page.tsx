import { AuthGate } from "@/components/auth/AuthGate";
import { CrystLApp } from "@/components/app/CrystLApp";

export default function Home() {
  return (
    <AuthGate>
      <CrystLApp />
    </AuthGate>
  );
}
