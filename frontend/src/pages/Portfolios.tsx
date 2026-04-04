import { motion } from "framer-motion";
import { Globe, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/use-auth";
import { toast } from "sonner";

type DomainSetup = {
  domain?: string;
  status?: string;
  cnameTarget?: string;
  instructions?: string;
};

type PublishResponse = {
  success: boolean;
  url?: string;
  domainSetup?: DomainSetup | null;
  error?: string;
  traceId?: string;
  details?: string;
};

const Portfolios = () => {
  const { idToken } = useAuth();
  const [preference, setPreference] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [domainSetup, setDomainSetup] = useState<DomainSetup | null>(null);

  const publishEndpoint = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    return apiBase.replace(/\/api\/v1\/?$/i, "") + "/portfolio/publish";
  }, []);

  const handlePublish = async () => {
    if (!idToken) {
      toast.error("Please sign in first");
      return;
    }

    try {
      setPublishing(true);

      const response = await fetch(publishEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          preference,
          customDomain: customDomain.trim()
        })
      });

      const payload = (await response.json()) as PublishResponse;

      if (!response.ok || !payload.success) {
        const message = payload.details || payload.error || "Failed to publish portfolio";
        const traceSuffix = payload.traceId ? ` (trace: ${payload.traceId.slice(0, 8)})` : "";
        toast.error(`${message}${traceSuffix}`);
        return;
      }

      setLiveUrl(payload.url || "");
      setDomainSetup(payload.domainSetup || null);
      toast.success("Portfolio published successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish portfolio");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Portfolios</h1>
            <p className="text-muted-foreground">Publish your portfolio in one click with AI generation and Cloudflare Pages deploy.</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">1-Click Publish</Badge>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6"
      >
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Flow: Generate HTML with Groq {"->"} Deploy to Cloudflare Pages</p>
            <p className="text-xs text-muted-foreground">Optional custom domain setup will return CNAME instructions automatically.</p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border/50 bg-card/40 p-4"
        >
          <h2 className="font-semibold text-foreground mb-3">Publish Portfolio</h2>
          <div className="space-y-3 mb-3">
            <Textarea
              value={preference}
              onChange={(event) => setPreference(event.target.value)}
              placeholder="Apni style preference likho... e.g. minimal, dark, projects-first, bold hero"
              className="min-h-[110px]"
            />
            <Input
              value={customDomain}
              onChange={(event) => setCustomDomain(event.target.value)}
              placeholder="Optional custom domain (e.g. portfolio.example.com)"
            />
          </div>
          <Button variant="hero" size="sm" onClick={handlePublish} disabled={publishing || !idToken}>
            {publishing ? "Publishing..." : "Publish Portfolio"}
          </Button>
        </motion.div>

        {liveUrl ? (
          <motion.div
            key={liveUrl}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/40"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground font-mono text-sm">{liveUrl}</p>
                  <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">LIVE</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Share this URL with anyone to view your portfolio.</p>
              </div>
            </div>
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
            </a>
          </motion.div>
        ) : null}

        {domainSetup ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-xl border border-border/50 bg-card/40 p-4"
          >
            <h2 className="font-semibold text-foreground mb-3">Custom Domain Setup</h2>
            <div className="space-y-2 text-sm">
              {domainSetup.domain ? <p><strong>Domain:</strong> {domainSetup.domain}</p> : null}
              {domainSetup.status ? <p><strong>Status:</strong> {domainSetup.status}</p> : null}
              {domainSetup.cnameTarget ? <p><strong>CNAME Target:</strong> {domainSetup.cnameTarget}</p> : null}
              {domainSetup.instructions ? (
                <p className="inline-flex items-center gap-2 text-primary"><LinkIcon className="h-4 w-4" />{domainSetup.instructions}</p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default Portfolios;
