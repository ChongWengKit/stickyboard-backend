import { Router } from "express";
import { boardController } from "../controller/boardController.js";
import { cronController } from "../controller/cronController.js";
import { chatController } from "../controller/chatController.js";
const router = Router();

router.get("/board", boardController.getBoard);
router.post("/board", boardController.addNote);
router.get("/board/snapshot", cronController.triggerSnapshot);
router.post("/chat", chatController.chat);

export default router;
