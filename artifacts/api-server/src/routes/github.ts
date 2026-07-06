import { Router } from "express";
import { db } from "@workspace/db";
import { modelVersionsTable } from "@workspace/db";

const router = Router();

interface GithubRepoInfo {
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  html_url: string;
  open_issues_count: number;
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const clean = url.replace(/\.git$/, "").replace(/\/$/, "");
    const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

router.post("/github/import-model", async (req, res) => {
  const { githubUrl, version, dailyUsers } = req.body ?? {};
  if (!githubUrl) {
    res.status(400).json({ error: "githubUrl is required" });
    return;
  }

  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    res.status(400).json({ error: "Invalid GitHub URL. Expected format: https://github.com/owner/repo" });
    return;
  }

  // Fetch repo metadata from GitHub public API
  let repoInfo: GithubRepoInfo;
  try {
    const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "ml-monitor/1.0" },
    });
    if (!response.ok) {
      res.status(400).json({ error: `GitHub repo not found or not accessible: ${parsed.owner}/${parsed.repo}` });
      return;
    }
    repoInfo = await response.json() as GithubRepoInfo;
  } catch {
    res.status(502).json({ error: "Failed to reach GitHub API" });
    return;
  }

  // Derive a health signal from repo metadata
  const daysSinceUpdate = Math.floor((Date.now() - new Date(repoInfo.updated_at).getTime()) / 86400000);
  const health = daysSinceUpdate > 180 ? "warning" : "good";

  // Register the model
  const [model] = await db.insert(modelVersionsTable).values({
    name: repoInfo.name,
    version: version ?? "v1.0.0",
    description: repoInfo.description ?? `Imported from ${repoInfo.full_name}. Language: ${repoInfo.language ?? "unknown"}. Stars: ${repoInfo.stargazers_count}.`,
    dailyUsers: dailyUsers ?? 0,
    status: "active",
  }).returning();

  res.json({
    model: {
      id: model.id,
      name: model.name,
      version: model.version,
      status: model.status,
      deployedAt: model.deployedAt.toISOString(),
      dailyUsers: model.dailyUsers,
      description: model.description,
    },
    repoHealth: {
      health,
      stars: repoInfo.stargazers_count,
      language: repoInfo.language,
      openIssues: repoInfo.open_issues_count,
      daysSinceUpdate,
      defaultBranch: repoInfo.default_branch,
      url: repoInfo.html_url,
    },
  });
});

router.get("/github/check-repo", async (req, res) => {
  const { url } = req.query as Record<string, string>;
  if (!url) {
    res.status(400).json({ error: "url query param required" });
    return;
  }
  const parsed = parseGithubUrl(url);
  if (!parsed) {
    res.status(400).json({ error: "Invalid GitHub URL" });
    return;
  }
  try {
    const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "ml-monitor/1.0" },
    });
    if (!response.ok) {
      res.json({ valid: false, error: "Repo not found or private" });
      return;
    }
    const info = await response.json() as GithubRepoInfo;
    const daysSinceUpdate = Math.floor((Date.now() - new Date(info.updated_at).getTime()) / 86400000);
    res.json({
      valid: true,
      name: info.name,
      fullName: info.full_name,
      description: info.description,
      language: info.language,
      stars: info.stargazers_count,
      openIssues: info.open_issues_count,
      daysSinceUpdate,
      health: daysSinceUpdate > 180 ? "stale" : "active",
    });
  } catch {
    res.json({ valid: false, error: "Failed to reach GitHub API" });
  }
});

export default router;
