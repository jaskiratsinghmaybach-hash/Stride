import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { supabase, supabaseConfigured } from "./supabase";
import type { OnboardingData, StrideProfile } from "./types";

const PROFILE_KEY = "stride.profile";
const ONBOARDING_KEY = "stride.onboarding.complete";

type AuthContextValue = {
  session: Session | null;
  profile: StrideProfile | null;
  isLoading: boolean;
  onboardingComplete: boolean;
  signInWithGoogle: () => Promise<{ error?: string; cancelled?: boolean }>;
  saveOnboarding: (data: OnboardingData) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StrideProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      try {
        const [p, done] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);

        if (active && p) {
          setProfile(JSON.parse(p));
        }

        if (active) {
          setOnboardingComplete(done === "true");
        }

        if (supabase) {
          const { data } = await supabase.auth.getSession();

          if (active) {
            setSession(data.session);
          }

          const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, next) => {
              if (active) {
                setSession(next);
              }
            },
          );

          unsubscribe = () => listener.subscription.unsubscribe();
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      return {
        error:
          "Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      };
    }

    try {
      const webClientId =
        process.env.EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID;

      if (!webClientId) {
        return {
          error:
            "Google authentication is not configured. Add EXPO_PUBLIC_GOOGLE_AUTH_WEB_CLIENT_ID to .env.",
        };
      }

      GoogleSignin.configure({
        webClientId,
      });

      await GoogleSignin.hasPlayServices();

      const result = await GoogleSignin.signIn();

      if (!result.data?.idToken) {
        return {
          error: "Google did not return an ID token.",
        };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.data.idToken,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
      }

      return {};
    } catch (error) {
      console.error("[Google Sign-In Error]:", error);
      const rawMessage =
        error instanceof Error ? error.message : "Google sign-in failed.";

      let userMessage = rawMessage;
      if (rawMessage.includes("DEVELOPER_ERROR")) {
        userMessage =
          "Google Sign-In DEVELOPER_ERROR: The Android SHA-1 fingerprint is missing in Firebase / Google Cloud Console, or the Web Client ID in .env does not match.";
      }

      return { error: userMessage };
    }
  }, []);

  const saveOnboarding = useCallback(
    async (data: OnboardingData) => {
      let userId = session?.user.id;

      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData.user?.id ?? userId;
      }

      const finalUserId = userId ?? "local-preview-user";

      const p: StrideProfile = {
        ...data,
        userId: finalUserId,
      };

      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");

      setProfile(p);
      setOnboardingComplete(true);
    },
    [session?.user.id],
  );

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    await AsyncStorage.multiRemove([PROFILE_KEY, ONBOARDING_KEY]);

    setSession(null);
    setProfile(null);
    setOnboardingComplete(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isLoading,
        onboardingComplete,
        signInWithGoogle,
        saveOnboarding,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
