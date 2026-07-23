import { Router } from "express";
import type { Request, Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";

const router = Router();

// GET /api/v1/progress - 获取所有学习进度
router.get("/", async (_req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("learning_progress")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Query failed: ${error.message}`);
    res.json({ data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/v1/progress/project/:projectId - 获取某个项目的学习进度
router.get("/project/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId as string, 10);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("learning_progress")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Query failed: ${error.message}`);
    res.json({ data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/v1/progress - 创建学习进度
router.post("/", async (req: Request, res: Response) => {
  try {
    const { project_id, title, status, progress_percentage, notes, started_at, completed_at } = req.body;
    if (!project_id || !title) {
      res.status(400).json({ error: "project_id and title are required" });
      return;
    }
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("learning_progress")
      .insert({
        project_id,
        title,
        status: status || "not_started",
        progress_percentage: progress_percentage || 0,
        notes: notes || null,
        started_at: started_at || null,
        completed_at: completed_at || null,
      })
      .select()
      .single();
    if (error) throw new Error(`Insert failed: ${error.message}`);
    res.status(201).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// PATCH /api/v1/progress/:id - 更新学习进度
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("learning_progress")
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`Update failed: ${error.message}`);
    if (!data) {
      res.status(404).json({ error: "Progress item not found" });
      return;
    }
    res.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// DELETE /api/v1/progress/:id - 删除学习进度
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("learning_progress")
      .delete()
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`Delete failed: ${error.message}`);
    if (!data) {
      res.status(404).json({ error: "Progress item not found" });
      return;
    }
    res.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
