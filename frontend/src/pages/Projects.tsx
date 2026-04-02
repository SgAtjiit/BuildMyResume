import { motion } from "framer-motion";
import { Plus, ExternalLink, Github, Trash2, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/use-auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectItem = {
  _id: string;
  title: string;
  description: string;
  stack: string[];
  date?: string;
  githubUrl?: string;
  demoUrl?: string;
  source: "manual" | "readme";
  updatedAt: string;
};

const initialForm = {
  title: "",
  description: "",
  stack: "",
  date: "",
  githubUrl: "",
  demoUrl: ""
};

const Projects = () => {
  const { idToken } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readmeUploading, setReadmeUploading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [projects]
  );

  const fetchProjects = useCallback(async () => {
    if (!idToken) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<{ projects: ProjectItem[] }>("/projects", {
        token: idToken
      });
      setProjects(response.data.projects);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const openCreateDialog = () => {
    setEditingProjectId(null);
    setForm(initialForm);
    setShowAddDialog(true);
  };

  const openEditDialog = (project: ProjectItem) => {
    setEditingProjectId(project._id);
    setForm({
      title: project.title,
      description: project.description,
      stack: project.stack.join(", "),
      date: project.date ?? "",
      githubUrl: project.githubUrl ?? "",
      demoUrl: project.demoUrl ?? ""
    });
    setShowAddDialog(true);
  };

  const handleCreateOrUpdateProject = async () => {
    if (!idToken) {
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    try {
      setSubmitting(true);
      const endpoint = editingProjectId ? `/projects/${editingProjectId}` : "/projects";
      const method = editingProjectId ? "PATCH" : "POST";

      const response = await apiRequest<{ project: ProjectItem }>(endpoint, {
        method,
        token: idToken,
        body: {
          title: form.title,
          description: form.description,
          stack: form.stack,
          date: form.date,
          githubUrl: form.githubUrl,
          demoUrl: form.demoUrl
        }
      });

      if (editingProjectId) {
        setProjects((current) =>
          current.map((item) => (item._id === response.data.project._id ? response.data.project : item))
        );
      } else {
        setProjects((current) => [response.data.project, ...current]);
      }

      setForm(initialForm);
      setEditingProjectId(null);
      setShowAddDialog(false);
      toast.success(editingProjectId ? "Project updated successfully" : "Project created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReadmeUpload = async (file: File | null) => {
    if (!idToken || !file) {
      return;
    }

    try {
      setReadmeUploading(true);
      const formData = new FormData();
      formData.append("readmeFile", file);

      const response = await apiRequest<{ project: ProjectItem }>("/projects/from-readme", {
        method: "POST",
        token: idToken,
        body: formData
      });

      setProjects((current) => [response.data.project, ...current]);
      toast.success("Project imported from README");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import README");
    } finally {
      setReadmeUploading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!idToken) {
      return;
    }

    try {
      await apiRequest<{ projectId: string }>(`/projects/${projectId}`, {
        method: "DELETE",
        token: idToken
      });

      setProjects((current) => current.filter((project) => project._id !== projectId));
      toast.success("Project deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Projects</h1>
            <p className="text-muted-foreground">Manage your portfolio projects.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={readmeUploading}
              onClick={() => document.getElementById("readme-upload-input")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {readmeUploading ? "Importing..." : "Add via README"}
            </Button>
            <Button variant="hero" size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" /> Add Project
            </Button>
          </div>
          <input
            id="readme-upload-input"
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleReadmeUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </motion.div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading projects...</div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No projects yet. Add manually or import from a README file.
          </div>
        ) : (
          sortedProjects.map((project, index) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-5 rounded-xl border border-border/50 bg-card/40 group"
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{project.title}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Source: {project.source === "readme" ? "README" : "Manual"}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(project)}
                    title="Edit project"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteProject(project._id)}
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{project.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {project.stack.map((tech) => (
                    <Badge key={`${project._id}-${tech}`} variant="secondary" className="text-xs font-normal">
                      {tech}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {project.githubUrl ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(project.githubUrl, "_blank", "noopener,noreferrer")}
                      title="Open GitHub"
                    >
                      <Github className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {project.demoUrl ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(project.demoUrl, "_blank", "noopener,noreferrer")}
                      title="Open demo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProjectId ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[110px]"
            />
            <Input
              placeholder="Tech stack (comma separated, e.g. React, Node.js, MongoDB)"
              value={form.stack}
              onChange={(event) => setForm((current) => ({ ...current, stack: event.target.value }))}
            />
            <Input
              placeholder="Date (optional, e.g. Jan 2025 - Mar 2025)"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            />
            <Input
              placeholder="GitHub URL (optional)"
              value={form.githubUrl}
              onChange={(event) => setForm((current) => ({ ...current, githubUrl: event.target.value }))}
            />
            <Input
              placeholder="Demo URL (optional)"
              value={form.demoUrl}
              onChange={(event) => setForm((current) => ({ ...current, demoUrl: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={handleCreateOrUpdateProject} disabled={submitting}>
              {submitting ? "Saving..." : editingProjectId ? "Update Project" : "Save Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
