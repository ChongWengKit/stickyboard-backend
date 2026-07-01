import cron from "node-cron";
import puppeteer from "puppeteer";
import { v2 as cloudinary } from "cloudinary";
import { boardService } from "../service/boardService.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function takeScreenshot(): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 3000, height: 2000, deviceScaleFactor: 3});
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle0", timeout: 30000 });

    await page.waitForSelector(".sticky-note", { timeout: 15000 });
    const screenshotBuffer: any = await page.screenshot({ type: "png"});
    return Buffer.from(screenshotBuffer).toString("base64");
  } finally {
    await browser.close();
  }
}

async function uploadToCloudinary(base64Image: string): Promise<string> {
  const result = await cloudinary.uploader.upload(
    `data:image/png;base64,${base64Image}`,
    {
      folder: "stickyboard-background",
      public_id: `snapshot-${Date.now()}`,
      overwrite: true,
      quality: "auto"
    }
  );
  return result.secure_url;
}

export async function runSnapshotAndCleanup() {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return;
    }
    const noteIdsBefore = await boardService.getNoteIds();
    const base64Image = await takeScreenshot();
    const imageUrl = await uploadToCloudinary(base64Image);
    await boardService.updateBoardBackground(imageUrl);
    if (noteIdsBefore.length > 0) {
      await boardService.deleteNotesByIds(noteIdsBefore);
    }

  } catch (error) {
    console.error("[CronService] Snapshot and cleanup failed:", error);
  }
}

export function startCronJob() {
  const schedule = process.env.CRON_SCHEDULE || "0 0 0 * * *";
  cron.schedule(schedule, () => {
    runSnapshotAndCleanup();
  });
}