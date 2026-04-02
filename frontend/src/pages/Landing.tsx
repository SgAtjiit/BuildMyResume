import { motion } from "framer-motion";
import { ArrowRight, FileText, Layers, Globe, Sparkles, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/use-auth";

const features = [
  { icon: FileText, title: "Smart Resume Parsing", desc: "Upload PDF/DOCX and we auto-parse skills, experience, education & projects." },
  { icon: Sparkles, title: "AI-Powered Tailoring", desc: "Paste a job description and get a perfectly matched resume in seconds." },
  { icon: Layers, title: "Project Portfolio", desc: "Store and showcase your projects with rich details and media." },
  { icon: Globe, title: "Subdomain Portfolios", desc: "Generate unique portfolio URLs under your domain for each application." },
  { icon: Zap, title: "Multiple Templates", desc: "Choose from minimal, modern, and dev-focused resume & portfolio themes." },
  { icon: Download, title: "Export Anywhere", desc: "Download tailored resumes as PDF/DOCX or share portfolio links instantly." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Landing = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, loading, firebaseUser } = useAuth();

  const handleAuthClick = async () => {
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch {
      toast.error("Sign-in failed. Check your Firebase provider settings.");
    }
  };

  const handleGetStarted = async () => {
    if (firebaseUser) {
      navigate("/dashboard");
      return;
    }

    await handleAuthClick();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border/30">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-lg text-foreground">ResumeSubnet</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleAuthClick} disabled={loading}>
              Log in
            </Button>
            <Button variant="hero" size="sm" onClick={handleGetStarted} disabled={loading}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Resume Tailoring
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-foreground">Tailor Resumes.</span>
              <br />
              <span className="text-gradient">Generate Portfolios.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              Upload your master resume, paste any job description, and get a perfectly tailored resume plus a unique portfolio URL — all in seconds.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button variant="hero" size="lg" className="text-base px-8" onClick={handleGetStarted} disabled={loading}>
                Start Free <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="hero-outline" size="lg" className="text-base px-8">
                See Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Everything you need</h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              From resume parsing to portfolio deployment, all in one platform.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="group p-6 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 hover:border-primary/20 transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="relative rounded-2xl border border-primary/20 bg-card/30 p-12 md:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full w-96 h-96 mx-auto my-auto" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Ready to stand out?</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                Join thousands of professionals who tailor their resumes and portfolios with AI.
              </p>
              <Button variant="hero" size="lg" className="text-base px-10" onClick={handleGetStarted} disabled={loading}>
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 ResumeSubnet. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
