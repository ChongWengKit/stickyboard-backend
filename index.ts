import express from "express";
import cors from "cors";
import boardRoutes from "./src/routes/boardRoutes.js";
import { rateLimit } from 'express-rate-limit';
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
app.set('trust proxy', 1)

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many requests.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }

});
app.use(limiter);
app.use(express.json());
app.use("/api", boardRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});