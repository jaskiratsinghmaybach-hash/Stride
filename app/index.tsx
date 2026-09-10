import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";

export default function Index() {
  const { isLoading, session, onboardingComplete } = useAuth();
  if (isLoading) return null;
  if (!session || !onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/today" />;
}
