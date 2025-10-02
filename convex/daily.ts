import { query } from "./_generated/server";
import dayjs from "dayjs";

export const getDailySeed = query({
  handler: async () => {
    const now = dayjs();
    const seed = now.format("YYYY-MM-DD");
    return seed;
  },
});
