import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired live match rooms and related records periodically
crons.cron(
  "cleanupExpiredLiveRooms",
  "*/1 * * * *",
  // Cast to satisfy types until generated API picks up the internal mutation.
  (internal as any).rooms.cleanupExpiredRooms
);

export default crons;
