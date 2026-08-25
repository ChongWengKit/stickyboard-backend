import { Router } from "express";
import { boardController } from "../controller/board.controller.js";
import { cronController } from "../controller/cron.controller.js";
import { chatController } from "../controller/chat.controller.js";
const router = Router();

router.get("/board", boardController.getBoard);
router.post("/board", boardController.addNote);
router.get("/board/snapshot", cronController.triggerSnapshot);
router.post("/chat", chatController.chat);
router.get("/chat/messages", chatController.getMessages);
router.delete("/chat", chatController.clearMessages);

export default router;
