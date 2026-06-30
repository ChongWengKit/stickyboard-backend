import { Request, Response } from "express";
import { runSnapshotAndCleanup } from "../service/cronService.js";

export const cronController = {
  async triggerSnapshot(req: Request, res: Response) {
    try {
      await runSnapshotAndCleanup();
      res.json({ success: true, message: "Snapshot and cleanup triggered successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to trigger snapshot and cleanup" });
    }
  },
};