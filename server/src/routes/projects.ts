import { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();
const GITHUB_API = 'https://api.github.com';

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+)/,
    /^([^/]+)\/([^/]+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }
  return null;
}

// GET /api/v1/projects - List all projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('projects')
      .select('id, name, repo_url, owner, repo_name, description, stars, language, analysis_status, topics, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Query failed: ${error.message}`);
    res.json({ data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/v1/projects/import - Import a GitHub project
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { repo_url } = req.body as { repo_url: string };
    if (!repo_url) {
      res.status(400).json({ error: 'repo_url is required' });
      return;
    }

    const parsed = parseGitHubUrl(repo_url);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid GitHub URL. Use format: https://github.com/owner/repo or owner/repo' });
      return;
    }

    const { owner, repo } = parsed;
    const client = getSupabaseClient();

    // Check if already imported
    const { data: existing } = await client
      .from('projects')
      .select('id')
      .eq('repo_url', `https://github.com/${owner}/${repo}`)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: 'Project already imported', project_id: existing.id });
      return;
    }

    // Fetch repo info from GitHub API
    const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
      axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GitHubAgentScanner' },
        timeout: 10000,
      }),
      axios.get(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
        headers: { 'Accept': 'application/vnd.github.v3.raw', 'User-Agent': 'GitHubAgentScanner' },
        timeout: 10000,
      }),
      axios.get(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GitHubAgentScanner' },
        timeout: 10000,
      }),
    ]);

    if (repoRes.status !== 'fulfilled') {
      res.status(404).json({ error: 'GitHub repository not found or API rate limit exceeded' });
      return;
    }

    const repoData = repoRes.value.data;
    const readmeContent = readmeRes.status === 'fulfilled' ? readmeRes.value.data : null;

    // Extract file structure (limit to first 200 entries)
    let fileStructure = '';
    if (treeRes.status === 'fulfilled') {
      const tree = treeRes.value.data.tree || [];
      const files = tree.slice(0, 200).map((item: { path: string; type: string }) =>
        `${item.type === 'tree' ? '[DIR]' : '[FILE]'} ${item.path}`
      );
      fileStructure = files.join('\n');
    }

    const { data: inserted, error } = await client
      .from('projects')
      .insert({
        name: repoData.name || repo,
        repo_url: `https://github.com/${owner}/${repo}`,
        owner,
        repo_name: repo,
        description: repoData.description || '',
        stars: repoData.stargazers_count || 0,
        language: repoData.language || '',
        readme_content: readmeContent ? readmeContent.substring(0, 50000) : null,
        file_structure: fileStructure.substring(0, 20000),
        analysis_status: 'pending',
        topics: repoData.topics || [],
      })
      .select()
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);

    res.json({ data: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/v1/projects/:id - Get project details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/v1/projects/:id - Delete a project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) throw new Error(`Delete failed: ${error.message}`);

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
