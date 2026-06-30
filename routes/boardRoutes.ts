import { Router } from "express";
import { boardController } from "../controller/boardController";
import { cronController } from "../controller/cronController";

const router = Router();

router.get("/board", boardController.getBoard);
router.post("/board", boardController.addNote);
router.get("/board/snapshot", cronController.triggerSnapshot);

export default router;
