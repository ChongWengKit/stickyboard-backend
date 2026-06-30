import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_KEY || "",
  secret: process.env.PUSHER_SECRET || "",
  cluster: process.env.PUSHER_CLUSTER || "",
  useTLS: true,
});

export async function triggerNoteAdded(note: { id: string; x: number; y: number; description: string; color: string }) {
  await pusher.trigger("board", "note-added", note).catch(() => {});
}
