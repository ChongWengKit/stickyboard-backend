import { Router } from "express";
import { boardController } from "../controller/boardController.js";
import { cronController } from "../controller/cronController.js";
//test
const router = Router();

router.get("/board", boardController.getBoard);
router.post("/board", boardController.addNote);
router.get("/board/snapshot", cronController.triggerSnapshot);

export default router;
