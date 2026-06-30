import express from "express";
import cors from "cors";
import boardRoutes from "./src/routes/boardRoutes.js";
const allowedOrigins = [
  process.env.FRONTEND_URL,
];
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({

  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
  
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.options('*splat', cors());
app.use(express.json());
app.use("/api", boardRoutes);


app.listen(PORT, () => {
});