import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// WeChat configuration - these would be configured by the user
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || 'github_agent_scanner_token';

function verifyWeChatSignature(signature: string, timestamp: string, nonce: string): boolean {
  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return sha1 === signature;
}

function buildProjectContext(project: {
  name: string;
  description: string | null;
  language: string | null;
  readme_content: string | null;
  file_structure: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`Project: ${project.name}`);
  if (project.description) parts.push(`Description: ${project.description}`);
  if (project.language) parts.push(`Language: ${project.language}`);
  if (project.file_structure) {
    parts.push(`File Structure:\n${project.file_structure.substring(0, 3000)}`);
  }
  if (project.readme_content) {
    parts.push(`README:\n${project.readme_content.substring(0, 10000)}`);
  }
  return parts.join('\n\n');
}

// GET /api/v1/wechat/webhook - WeChat server verification
router.get('/webhook', (req: Request, res: Response) => {
  const { signature, timestamp, nonce, echostr } = req.query as Record<string, string>;

  if (!signature || !timestamp || !nonce || !echostr) {
    res.status(400).send('Missing parameters');
    return;
  }

  if (verifyWeChatSignature(signature, timestamp, nonce)) {
    res.send(echostr);
  } else {
    res.status(403).send('Invalid signature');
  }
});

// POST /api/v1/wechat/webhook - Handle WeChat messages
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { signature, timestamp, nonce } = req.query as Record<string, string>;

    if (!verifyWeChatSignature(signature || '', timestamp || '', nonce || '')) {
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    // Parse XML message from WeChat
    const xmlBody: string = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Simple XML parsing for WeChat message format
    const contentMatch = xmlBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/);
    const fromUserMatch = xmlBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/);
    const msgTypeMatch = xmlBody.match(/<MsgType><!\[CDATA\[(.*?)\]\]><\/MsgType>/);

    const content = contentMatch ? contentMatch[1] : '';
    const fromUser = fromUserMatch ? fromUserMatch[1] : '';
    const msgType = msgTypeMatch ? msgTypeMatch[1] : 'text';

    if (msgType !== 'text' || !content) {
      // Reply with a hint for non-text messages
      const replyXml = `<xml>
        <ToUserName><![CDATA[${fromUser}]]></ToUserName>
        <FromUserName><![CDATA[gh_agent_scanner]]></FromUserName>
        <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
        <MsgType><![CDATA[text]]></MsgType>
        <Content><![CDATA[Please send text messages. Usage:
1. "list" - List all imported projects
2. "ask <project_name> <question>" - Ask about a project
3. "import <github_url>" - Import a GitHub project]]></Content>
      </xml>`;
      res.set('Content-Type', 'application/xml');
      res.send(replyXml);
      return;
    }

    const client = getSupabaseClient();
    let replyText = '';

    // Parse command
    const lowerContent = content.toLowerCase().trim();

    if (lowerContent === 'list' || lowerContent === 'help' || lowerContent === '帮助') {
      // List projects
      const { data: projects } = await client
        .from('projects')
        .select('id, name, description, stars, language, analysis_status')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!projects || projects.length === 0) {
        replyText = 'No projects imported yet. Send "import <github_url>" to import a project.';
      } else {
        replyText = 'Imported Projects:\n\n';
        for (const p of projects) {
          const status = p.analysis_status === 'completed' ? '[Analyzed]' : '[Pending]';
          replyText += `${status} ${p.name} (${p.stars} stars)\n${p.description || 'No description'}\n\n`;
        }
        replyText += '\nUse "ask <project_name> <question>" to query a project.';
      }
    } else if (lowerContent.startsWith('import ')) {
      // Import project
      const repoUrl = content.substring(7).trim();
      replyText = `Importing ${repoUrl}... This may take a moment. Check the app for progress.`;

      // Trigger import in background (simplified - just acknowledge)
      // In production, this would be a background job
      try {
        const patterns = [/github\.com\/([^/]+)\/([^/]+)/, /^([^/]+)\/([^/]+)$/];
        let parsed = null;
        for (const pattern of patterns) {
          const match = repoUrl.match(pattern);
          if (match) {
            parsed = { owner: match[1], repo: match[2].replace(/\.git$/, '') };
            break;
          }
        }

        if (parsed) {
          const axios = (await import('axios')).default;
          const repoRes = await axios.get(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'GitHubAgentScanner' },
            timeout: 10000,
          });

          const { data: existing } = await client
            .from('projects')
            .select('id')
            .eq('repo_url', `https://github.com/${parsed.owner}/${parsed.repo}`)
            .maybeSingle();

          if (!existing) {
            await client.from('projects').insert({
              name: repoRes.data.name || parsed.repo,
              repo_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
              owner: parsed.owner,
              repo_name: parsed.repo,
              description: repoRes.data.description || '',
              stars: repoRes.data.stargazers_count || 0,
              language: repoRes.data.language || '',
              analysis_status: 'pending',
              topics: repoRes.data.topics || [],
            });
            replyText = `Successfully imported "${repoRes.data.name}"! Use "list" to see all projects.`;
          } else {
            replyText = 'Project already imported. Use "list" to see all projects.';
          }
        } else {
          replyText = 'Invalid GitHub URL. Use format: import https://github.com/owner/repo';
        }
      } catch {
        replyText = 'Import failed. Please check the URL and try again.';
      }
    } else if (lowerContent.startsWith('ask ')) {
      // Ask about a project
      const askContent = content.substring(4).trim();
      const spaceIdx = askContent.indexOf(' ');
      if (spaceIdx === -1) {
        replyText = 'Usage: ask <project_name> <question>\nExample: ask langchain How does the agent planning work?';
      } else {
        const projectName = askContent.substring(0, spaceIdx);
        const question = askContent.substring(spaceIdx + 1);

        const { data: project } = await client
          .from('projects')
          .select('*')
          .ilike('name', `%${projectName}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!project) {
          replyText = `Project "${projectName}" not found. Use "list" to see available projects.`;
        } else {
          // Use LLM to answer
          const context = buildProjectContext(project);
          const config = new Config();
          const llmClient = new LLMClient(config);

          const messages = [
            {
              role: 'system' as const,
              content: `You are an AI assistant specialized in the GitHub project "${project.name}". Answer questions concisely in Chinese. Base your answers on the project context provided.\n\n${context}`,
            },
            { role: 'user' as const, content: question },
          ];

          try {
            const response = await llmClient.invoke(messages, {
              model: 'doubao-seed-2-0-mini-260215',
              temperature: 0.5,
            });
            replyText = response.content;
          } catch {
            replyText = 'Failed to generate answer. Please try again.';
          }
        }
      }
    } else {
      replyText = `GitHub Agent Scanner Commands:
- "list" / "help" - List projects & help
- "import <github_url>" - Import a project
- "ask <project_name> <question>" - Ask about a project

Example: ask autogen How does multi-agent conversation work?`;
    }

    // Format WeChat XML response
    const replyXml = `<xml>
      <ToUserName><![CDATA[${fromUser}]]></ToUserName>
      <FromUserName><![CDATA[gh_agent_scanner]]></FromUserName>
      <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[${replyText}]]></Content>
    </xml>`;

    res.set('Content-Type', 'application/xml');
    res.send(replyXml);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/v1/wechat/config - Get WeChat webhook URL info
router.get('/config', (_req: Request, res: Response) => {
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';
  res.json({
    data: {
      webhook_url: `${baseUrl}/api/v1/wechat/webhook`,
      token: WECHAT_TOKEN,
      instructions: {
        step1: 'Go to WeChat Official Account Platform (mp.weixin.qq.com)',
        step2: 'Navigate to Settings > Basic Configuration > Server Configuration',
        step3: `Set URL to: ${baseUrl}/api/v1/wechat/webhook`,
        step4: `Set Token to: ${WECHAT_TOKEN}`,
        step5: 'Set Encoding to: Plaintext mode',
        step6: 'Click Submit to verify the configuration',
      },
    },
  });
});

export default router;
