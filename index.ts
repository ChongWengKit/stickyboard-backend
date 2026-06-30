import express from "express";
import cors from "cors";
import boardRoutes from "./routes/boardRoutes";
import { startCronJob } from "./service/cronService";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" || "http://192.168.0.171:3000"}));
app.use(express.json());
app.use("/api", boardRoutes);


app.listen(PORT, () => {
  console.log(`Stickyboard backend running on http://localhost:${PORT}`);
});