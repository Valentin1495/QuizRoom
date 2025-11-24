import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired live match rooms and related records periodically
crons.cron(
  "cleanupExpiredLiveRooms",
  "*/10 * * * *",
  // Cast to satisfy types until generated API picks up the internal mutation.
  (internal as any).rooms.cleanupExpiredRooms
);

crons.cron(
  "cleanupStaleLiveParticipants",
  "*/2 * * * *",
  (internal as any).rooms.cleanupStaleParticipants
);

export default crons;
