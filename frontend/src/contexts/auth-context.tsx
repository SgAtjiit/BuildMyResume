import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase";
import { apiRequest } from "@/lib/api";
import { AuthContext } from "@/contexts/auth-context-value";
import type { AuthContextValue } from "@/contexts/auth-context-value";
import type { BackendUser } from "@/contexts/auth-context-types";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!idToken) {
      setBackendUser(null);
      return;
    }

    const response = await apiRequest<{ user: BackendUser }>("/auth/me", {
      token: idToken
    });

    setBackendUser(response.data.user);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setFirebaseUser(nextUser);

      if (!nextUser) {
        setIdToken(null);
        setBackendUser(null);
        setLoading(false);
        return;
      }

      const token = await nextUser.getIdToken();
      setIdToken(token);

      try {
        const response = await apiRequest<{ user: BackendUser }>("/auth/me", {
          token
        });
        setBackendUser(response.data.user);
      } catch {
        setBackendUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(firebaseAuth, googleProvider);
  };

  const signOutUser = async () => {
    await signOut(firebaseAuth);
    setFirebaseUser(null);
    setBackendUser(null);
    setIdToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        backendUser,
        idToken,
        loading,
        signInWithGoogle,
        signOutUser,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

