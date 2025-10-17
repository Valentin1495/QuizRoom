import { v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";

export const ensureDeckBySlug = mutation({
    args: {
        slug: v.string(),
        title: v.optional(v.string()),
        // ✅ 스키마의 필수값들을 외부에서 받거나 기본값 사용
        authorId: v.id("users"),
        visibility: v.optional(v.union(v.literal("public"), v.literal("unlisted"), v.literal("private"))),
        language: v.optional(v.string()),
        status: v.optional(v.union(v.literal("draft"), v.literal("published"), v.literal("blocked"))),
        tags: v.optional(v.array(v.string())),
        description: v.optional(v.string()),
    },
    handler: async (ctx: MutationCtx, args): Promise<Id<"decks">> => {
        const now = Math.floor(Date.now() / 1000);

        const existing = await ctx.db
            .query("decks")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        const base: Omit<Doc<"decks">, "_id" | "_creationTime"> = {
            // 필수 필드들 기본값/인자 매핑
            title: args.title ?? args.slug,
            description: args.description ?? "",
            tags: args.tags ?? [],
            authorId: args.authorId,
            visibility: args.visibility ?? "unlisted",
            language: args.language ?? "ko",
            plays: 0,
            likes: 0,
            status: args.status ?? "draft",
            createdAt: now,
            updatedAt: now,
            // ✅ 스키마에 slug 필드를 추가해두셨다는 전제
            slug: args.slug,
        } as any;

        if (existing) {
            // 필요한 필드만 갱신 (createdAt은 유지)
            await ctx.db.patch(existing._id, {
                title: base.title,
                description: base.description,
                tags: base.tags,
                authorId: base.authorId,
                visibility: base.visibility,
                language: base.language,
                status: base.status,
                updatedAt: now,
                // slug는 불변으로 두는 걸 권장
            } as Partial<Doc<"decks">>);
            return existing._id;
        }

        const id = await ctx.db.insert("decks", base as any);
        return id;
    },
});
