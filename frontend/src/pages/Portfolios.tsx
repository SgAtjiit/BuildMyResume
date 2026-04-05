import { motion } from "framer-motion";
import { Globe, Github, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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

type GitHubExportResponse = {
  success: boolean;
  repoUrl?: string;
  owner?: string;
  repoName?: string;
  branch?: string;
  pathPrefix?: string;
  filesUpdated?: number;
  createdRepo?: boolean;
  error?: string;
  details?: string;
  traceId?: string;
};

type ThemeOption = "minimal" | "dark" | "glassmorphism" | "cyberpunk";
type FontOption = "Inter" | "JetBrains Mono" | "Sora" | "Space Grotesk";
type AnimationOption = "none" | "subtle" | "rich";

type PublishPreference = {
  theme: ThemeOption;
  font: FontOption;
  animations: AnimationOption;
  accent: string;
  notes: string;
};

type GitHubExportForm = {
  token: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  pathPrefix: string;
  privateRepo: boolean;
};

const DEFAULT_PREFERENCE: PublishPreference = {
  theme: "minimal",
  font: "Inter",
  animations: "subtle",
  accent: "#0ea5e9",
  notes: ""
};

const PUBLISH_STEPS = [
  "Preparing profile data",
  "Generating React template",
  "Building dist assets",
  "Uploading to Cloudflare"
];

const DEFAULT_GITHUB_EXPORT_FORM: GitHubExportForm = {
  token: "",
  repoOwner: "",
  repoName: "",
  branch: "main",
  pathPrefix: "",
  privateRepo: false
};

const Portfolios = () => {
  const { idToken } = useAuth();
  const [preference, setPreference] = useState<PublishPreference>(DEFAULT_PREFERENCE);
  const [customDomain, setCustomDomain] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState(0);
  const [liveUrl, setLiveUrl] = useState("");
  const [domainSetup, setDomainSetup] = useState<DomainSetup | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubExporting, setGithubExporting] = useState(false);
  const [githubExportResult, setGithubExportResult] = useState<GitHubExportResponse | null>(null);
  const [githubForm, setGithubForm] = useState<GitHubExportForm>(DEFAULT_GITHUB_EXPORT_FORM);

  const publishEndpoint = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    return apiBase.replace(/\/api\/v1\/?$/i, "") + "/portfolio/publish";
  }, []);

  const githubExportEndpoint = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || "";
    return apiBase.replace(/\/api\/v1\/?$/i, "") + "/portfolio/github";
  }, []);

  const handlePublish = async () => {
    if (!idToken) {
      toast.error("Please sign in first");
      return;
    }

    try {
      setPublishing(true);
      setPublishStep(1);

      const preferencePayload = {
        theme: preference.theme,
        font: preference.font,
        animations: preference.animations,
        accent: preference.accent,
        notes: preference.notes.trim()
      };

      setPublishStep(2);

      const response = await fetch(publishEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          preference: preferencePayload,
          customDomain: customDomain.trim()
        })
      });

      setPublishStep(3);

      const payload = (await response.json()) as PublishResponse;

      if (!response.ok || !payload.success) {
        const message = payload.details || payload.error || "Failed to publish portfolio";
        const traceSuffix = payload.traceId ? ` (trace: ${payload.traceId.slice(0, 8)})` : "";
        toast.error(`${message}${traceSuffix}`);
        return;
      }

      setLiveUrl(payload.url || "");
      setDomainSetup(payload.domainSetup || null);
      setPublishStep(4);
      toast.success("Portfolio published successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish portfolio");
    } finally {
      setPublishing(false);
    }
  };

  const handleExportToGitHub = async () => {
    if (!idToken) {
      toast.error("Please sign in first");
      return;
    }

    if (!githubForm.token.trim() || !githubForm.repoName.trim()) {
      toast.error("GitHub token and repository name are required");
      return;
    }

    try {
      setGithubExporting(true);

      const response = await fetch(githubExportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token: githubForm.token.trim(),
          repoOwner: githubForm.repoOwner.trim(),
          repoName: githubForm.repoName.trim(),
          branch: githubForm.branch.trim() || "main",
          pathPrefix: githubForm.pathPrefix.trim(),
          createRepo: true,
          privateRepo: githubForm.privateRepo,
          preference: {
            theme: preference.theme,
            font: preference.font,
            animations: preference.animations,
            accent: preference.accent,
            notes: preference.notes.trim()
          }
        })
      });

      const payload = (await response.json()) as GitHubExportResponse;

      if (!response.ok || !payload.success) {
        const message = payload.details || payload.error || "Failed to export portfolio to GitHub";
        const traceSuffix = payload.traceId ? ` (trace: ${payload.traceId.slice(0, 8)})` : "";
        toast.error(`${message}${traceSuffix}`);
        return;
      }

      setGithubExportResult(payload);
      setGithubDialogOpen(false);
      toast.success("Portfolio source exported to GitHub successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export portfolio to GitHub");
    } finally {
      setGithubExporting(false);
    }
  };

  const progressValue = useMemo(() => {
    if (!publishing && publishStep === 0) {
      return 0;
    }

    const capped = Math.min(publishStep, PUBLISH_STEPS.length);
    return Math.round((capped / PUBLISH_STEPS.length) * 100);
  }, [publishing, publishStep]);

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
            <p className="text-sm font-medium text-foreground">Flow: Generate React template {"->"} Build dist {"->"} Deploy to Cloudflare Pages</p>
            <p className="text-xs text-muted-foreground">Uses profile JSON + style controls (theme, font, animation, accent) for generation.</p>
          </div>
        </div>
      </motion.div>

      {publishing || publishStep > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-xl border border-border/50 bg-card/40 p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-foreground">Deployment Progress</h2>
            <span className="text-xs text-muted-foreground">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {publishStep > 0 ? PUBLISH_STEPS[Math.min(publishStep - 1, PUBLISH_STEPS.length - 1)] : "Waiting"}
          </p>
        </motion.div>
      ) : null}

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border/50 bg-card/40 p-4"
        >
          <h2 className="font-semibold text-foreground mb-3">Publish Portfolio</h2>
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Theme</p>
              <Select
                value={preference.theme}
                onValueChange={(value) => setPreference((prev) => ({ ...prev, theme: value as ThemeOption }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="glassmorphism">Glassmorphism</SelectItem>
                  <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Font</p>
              <Select
                value={preference.font}
                onValueChange={(value) => setPreference((prev) => ({ ...prev, font: value as FontOption }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                  <SelectItem value="Sora">Sora</SelectItem>
                  <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Animations</p>
              <Select
                value={preference.animations}
                onValueChange={(value) => setPreference((prev) => ({ ...prev, animations: value as AnimationOption }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select animation intensity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="subtle">Subtle</SelectItem>
                  <SelectItem value="rich">Rich</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Accent Color</p>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={preference.accent}
                  onChange={(event) => setPreference((prev) => ({ ...prev, accent: event.target.value }))}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  value={preference.accent}
                  onChange={(event) => setPreference((prev) => ({ ...prev, accent: event.target.value }))}
                  placeholder="#0ea5e9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-3">
            <Textarea
              value={preference.notes}
              onChange={(event) => setPreference((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Extra design notes (optional), e.g. high-contrast hero, cleaner project cards, large section titles"
              className="min-h-[90px]"
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
            className="p-4 rounded-xl border border-border/50 bg-card/40 space-y-4"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground font-mono text-sm break-all">{liveUrl}</p>
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">LIVE</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Share this URL with anyone to view your portfolio.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                </a>
                <Button variant="hero" size="sm" className="gap-2" onClick={() => setGithubDialogOpen(true)}>
                  <Github className="h-4 w-4" />
                  Add to GitHub
                </Button>
              </div>
            </div>

            {githubExportResult ? (
              <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-sm">
                <p className="font-semibold text-foreground">GitHub Export Ready</p>
                <p className="text-muted-foreground mt-1 break-all">
                  Repo: <a className="text-primary underline" href={githubExportResult.repoUrl} target="_blank" rel="noreferrer">{githubExportResult.repoUrl}</a>
                </p>
                <p className="text-muted-foreground mt-1">
                  Branch: {githubExportResult.branch || "main"} · Files updated: {githubExportResult.filesUpdated ?? 0}
                </p>
              </div>
            ) : null}
          </motion.div>
        ) : null}

        <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add Generated Portfolio to GitHub</DialogTitle>
              <DialogDescription>
                Enter a GitHub personal access token and repo details. The backend will regenerate the same portfolio source tree and push it to your repo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">GitHub Token</p>
                <Input
                  type="password"
                  value={githubForm.token}
                  onChange={(event) => setGithubForm((prev) => ({ ...prev, token: event.target.value }))}
                  placeholder="ghp_..."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Repository Owner</p>
                  <Input
                    value={githubForm.repoOwner}
                    onChange={(event) => setGithubForm((prev) => ({ ...prev, repoOwner: event.target.value }))}
                    placeholder="Optional, defaults to authenticated user"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Repository Name</p>
                  <Input
                    value={githubForm.repoName}
                    onChange={(event) => setGithubForm((prev) => ({ ...prev, repoName: event.target.value }))}
                    placeholder="my-portfolio"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Branch</p>
                  <Input
                    value={githubForm.branch}
                    onChange={(event) => setGithubForm((prev) => ({ ...prev, branch: event.target.value }))}
                    placeholder="main"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Path Prefix</p>
                  <Input
                    value={githubForm.pathPrefix}
                    onChange={(event) => setGithubForm((prev) => ({ ...prev, pathPrefix: event.target.value }))}
                    placeholder="Optional folder path in repo"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Visibility</p>
                <Select
                  value={githubForm.privateRepo ? "private" : "public"}
                  onValueChange={(value) => setGithubForm((prev) => ({ ...prev, privateRepo: value === "private" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setGithubDialogOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={handleExportToGitHub} disabled={githubExporting}>
                {githubExporting ? "Exporting..." : "Export to GitHub"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
