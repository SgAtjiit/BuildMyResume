import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { FileText, FolderOpen, Sparkles, Globe, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/use-auth";

const links = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/dashboard/resumes", icon: FileText, label: "Resumes" },
  { to: "/dashboard/projects", icon: FolderOpen, label: "Projects" },
  { to: "/dashboard/tailor", icon: Sparkles, label: "AI Tailor" },
  { to: "/dashboard/portfolios", icon: Globe, label: "Portfolios" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendUser, signOutUser } = useAuth();

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/");
  };

  return (
    <aside className="w-60 h-screen sticky top-0 flex flex-col border-r border-border/50 bg-sidebar">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border/50">
        <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <FileText className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="font-semibold text-foreground">BuildMyResume</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <link.icon className={cn("h-4 w-4", isActive && "text-primary")} />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden">
            {backendUser?.photoURL ? (
              <img src={backendUser.photoURL} alt={backendUser.displayName ?? "User"} className="h-full w-full object-cover" />
            ) : (
              (backendUser?.displayName ?? "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{backendUser?.displayName ?? "Signed in user"}</p>
            <p className="text-xs text-muted-foreground truncate">{backendUser?.email ?? "Firebase authenticated"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
