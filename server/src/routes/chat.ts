import { Router } from 'express';
import type { Request, Response } from 'express';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

function buildProjectContext(project: {
  name: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  readme_content: string | null;
  file_structure: string | null;
  topics: unknown;
}): string {
  const parts: string[] = [];
  parts.push(`## Project: ${project.name}`);
  if (project.description) parts.push(`\nDescription: ${project.description}`);
  if (project.language) parts.push(`\nPrimary Language: ${project.language}`);
  if (project.stars) parts.push(`\nStars: ${project.stars}`);
  if (project.topics && Array.isArray(project.topics) && (project.topics as string[]).length > 0) {
    parts.push(`\nTopics: ${(project.topics as string[]).join(', ')}`);
  }
  if (project.file_structure) {
    parts.push(`\n## File Structure\n\`\`\`\n${project.file_structure.substring(0, 5000)}\n\`\`\``);
  }
  if (project.readme_content) {
    parts.push(`\n## README\n${project.readme_content.substring(0, 20000)}`);
  }
  return parts.join('\n');
}

// POST /api/v1/projects/:id/analyze - Analyze project with LLM (SSE)
router.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const client = getSupabaseClient();
    const { data: project, error } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Update status to analyzing
    await client.from('projects').update({ analysis_status: 'analyzing' }).eq('id', id);

    const context = buildProjectContext(project);

    const systemPrompt = `You are an expert AI Agent analyst. Analyze the following GitHub open-source project and provide a comprehensive analysis in Chinese. Structure your response as follows:

1. **项目概述**: Brief summary of what the project does
2. **核心架构**: Key architectural patterns and design decisions
3. **技术栈**: Technologies, frameworks, and libraries used
4. **Agent 能力**: If this is an AI Agent project, describe its agent capabilities (tool use, planning, memory, multi-agent coordination, etc.)
5. **关键模块**: Important modules/components and their responsibilities
6. **亮点与创新**: What makes this project stand out
7. **潜在改进**: Suggestions for improvement

Be specific and reference actual files/code patterns from the project. Keep the analysis concise but insightful.`;

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const llmConfig = new Config();
    const llmClient = new LLMClient(llmConfig, customHeaders);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Please analyze this project:\n\n${context}` },
    ];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    let fullContent = '';

    try {
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.5,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString();
          fullContent += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream error';
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    }

    // Save analysis result
    if (fullContent) {
      await client.from('projects').update({
        analysis_result: fullContent,
        analysis_status: 'completed',
      }).eq('id', id);
    } else {
      await client.from('projects').update({ analysis_status: 'failed' }).eq('id', id);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// POST /api/v1/projects/:id/chat - Chat about a project (SSE)
router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const { message, history } = req.body as { message: string; history?: Array<{ role: string; content: string }> };
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const client = getSupabaseClient();
    const { data: project, error } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const context = buildProjectContext(project);

    const systemPrompt = `You are an AI assistant specialized in the GitHub project "${project.name}". You have deep knowledge of this project based on its README, file structure, and codebase information.

Answer questions about this project accurately and helpfully in Chinese. If the question is about specific code or architecture, reference actual files and patterns from the project. If you don't have enough information, say so honestly.

## Project Context:
${context}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system' as const, content: systemPrompt },
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
    }

    messages.push({ role: 'user' as const, content: message });

    // Save user message
    await client.from('conversations').insert({
      project_id: id,
      role: 'user',
      content: message,
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const llmConfig = new Config();
    const llmClient = new LLMClient(llmConfig, customHeaders);

    let fullContent = '';

    try {
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString();
          fullContent += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream error';
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    }

    // Save assistant message
    if (fullContent) {
      await client.from('conversations').insert({
        project_id: id,
        role: 'assistant',
        content: fullContent,
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// GET /api/v1/projects/:id/conversations - Get conversation history
router.get('/:id/conversations', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .select('id, role, content, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw new Error(`Query failed: ${error.message}`);

    res.json({ data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
