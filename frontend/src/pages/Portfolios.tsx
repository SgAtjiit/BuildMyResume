import { motion } from "framer-motion";
import { Globe, Copy, ExternalLink, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const mockPortfolios = [
  { id: 1, subdomain: "stripe-app", domain: "johndoe.dev", theme: "Modern", status: "Active", views: 48 },
  { id: 2, subdomain: "google-swe", domain: "johndoe.dev", theme: "Minimal", status: "Active", views: 23 },
  { id: 3, subdomain: "portfolio", domain: "johndoe.dev", theme: "Dev-focused", status: "Draft", views: 0 },
];

const Portfolios = () => {
  const [portfolios] = useState(mockPortfolios);

  return (
    <div className="p-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Portfolios</h1>
            <p className="text-muted-foreground">Manage your generated portfolio pages and subdomains.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="hero-outline" size="sm">
              <Settings className="h-4 w-4 mr-2" /> Domain Settings
            </Button>
            <Button variant="hero" size="sm">
              <Plus className="h-4 w-4 mr-2" /> New Portfolio
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Domain Config Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Domain connected: johndoe.dev</p>
            <p className="text-xs text-muted-foreground">Wildcard DNS configured · SSL active</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-primary">Manage</Button>
      </motion.div>

      {/* Portfolio List */}
      <div className="space-y-3">
        {portfolios.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/40 group"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground font-mono text-sm">{p.subdomain}.{p.domain}</p>
                  <Badge
                    variant="secondary"
                    className={p.status === "Active" ? "bg-primary/10 text-primary border-primary/20 text-xs" : "text-xs"}
                  >
                    {p.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.theme} theme · {p.views} views</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon"><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Portfolios;
