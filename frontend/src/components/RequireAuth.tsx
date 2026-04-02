import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/use-auth";

const RequireAuth = () => {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading session...
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
