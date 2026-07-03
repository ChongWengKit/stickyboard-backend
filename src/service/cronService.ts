import cron from "node-cron";
import puppeteer from "puppeteer-core";
import Chromium from "@sparticuz/chromium-min";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { boardService } from "../service/boardService.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function takeScreenshot(): Promise<string> {
  const board = await boardService.getBoard();
  const hasBackground = !!board.background;

  const browser = await puppeteer.launch({
    args: Chromium.args,
    defaultViewport: { width: 3000, height: 2000 },
    executablePath: await Chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar'
    ),
    headless: true,
  });

  try {
    if (hasBackground) {
      const page = await browser.newPage();
      await page.setViewport({ width: 3000, height: 2000});
      await page.goto(`${FRONTEND_URL}/snapshot`, { waitUntil: "networkidle0", timeout: 30000 });
      try {
        await page.waitForSelector(".sticky-note", { timeout: 10000 });
      } catch {
      }
      const notesRaw = await page.screenshot({
        type: "png",
        omitBackground: true,
      });
      const notesBuffer = Buffer.from(notesRaw);

      const notesMeta = await sharp(notesBuffer).metadata();
      const targetWidth = notesMeta.width!;
      const targetHeight = notesMeta.height!;
      const bgResponse = await fetch(board.background);
      const bgArrayBuffer = await bgResponse.arrayBuffer();
      const bgBuffer = Buffer.from(bgArrayBuffer);
      const composited = await sharp(bgBuffer)
        .resize(targetWidth, targetHeight, { fit: "fill" })
        .composite([
          {
            input: notesBuffer,
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      return composited.toString("base64");
    } else {
      const page = await browser.newPage();
      await page.setViewport({ width: 3000, height: 2000 });
      await page.goto(FRONTEND_URL, { waitUntil: "networkidle0", timeout: 30000 });
      await page.waitForSelector(".sticky-note", { timeout: 15000 });
      const screenshotBuffer = await page.screenshot({ type: "png" });
      return Buffer.from(screenshotBuffer).toString("base64");
    }
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
      quality: "auto",
    }
  );
  return result.secure_url;
}

export async function runSnapshotAndCleanup() {
  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return;
    }
    const noteIdsBefore = await boardService.getNoteIds();
    const base64Image = await takeScreenshot();
    const imageUrl = await uploadToCloudinary(base64Image);
    await boardService.updateBoardBackgroundAndDeleteNotes(imageUrl, noteIdsBefore);
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