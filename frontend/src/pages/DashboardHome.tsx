import { motion } from "framer-motion";
import { FileText, Globe, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/use-auth";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type DashboardSummary = {
  stats: {
    resumes: number;
    tailoredVersions: number;
    portfolios: number;
    viewsThisWeek: number;
  };
  recentActivity: Array<{
    action: string;
    target: string;
    time: string;
  }>;
};

const DashboardHome = () => {
  const { backendUser, idToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!idToken) {
        return;
      }

      try {
        const response = await apiRequest<DashboardSummary>("/dashboard/summary", { token: idToken });
        setSummary(response.data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
      }
    };

    void loadSummary();
  }, [idToken]);

  const stats = useMemo(
    () => [
      { label: "Master Resumes", value: String(summary?.stats.resumes ?? 0), icon: FileText, color: "text-primary" },
      { label: "Tailored Versions", value: String(summary?.stats.tailoredVersions ?? 0), icon: Sparkles, color: "text-primary" },
      { label: "Active Portfolios", value: String(summary?.stats.portfolios ?? 0), icon: Globe, color: "text-primary" },
      { label: "Views This Week", value: String(summary?.stats.viewsThisWeek ?? 0), icon: TrendingUp, color: "text-primary" }
    ],
    [summary]
  );

  const recentActivity = summary?.recentActivity ?? [];

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground mb-8">Welcome back{backendUser?.displayName ? `, ${backendUser.displayName}` : ""}. Here's your overview.</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 rounded-xl border border-border/50 bg-card/40"
          >
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-card/40">
        <div className="px-5 py-4 border-b border-border/50">
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border/30">
          {recentActivity.length === 0 ? (
            <div className="px-5 py-3.5 text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            recentActivity.map((item, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.target}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(item.time).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
