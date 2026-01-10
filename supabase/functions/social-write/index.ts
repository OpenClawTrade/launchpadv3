import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SocialWriteRequest =
  | {
      type: "create_post";
      userId: string;
      content: string;
      imageUrl?: string | null;
      parentId?: string | null;
    }
  | {
      type: "delete_post";
      userId: string;
      postId: string;
    }
  | {
      type: "edit_post";
      userId: string;
      postId: string;
      content: string;
      removeImage?: boolean;
    }
  | {
      type: "toggle_like";
      userId: string;
      postId: string;
    }
  | {
      type: "toggle_bookmark";
      userId: string;
      postId: string;
    }
  | {
      type: "toggle_repost";
      userId: string;
      postId: string;
    }
  | {
      type: "track_view";
      postId: string;
    }
  | {
      type: "follow_user";
      userId: string;
      targetUserId: string;
    }
  | {
      type: "verify_user";
      userId: string;
      verifiedType: "blue" | "gold";
    };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SocialWriteRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (body.type === "create_post") {
      const content = body.content?.trim();
      if (!body.userId || !content) return json({ error: "userId and content are required" }, 400);

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: body.userId,
          content,
          image_url: body.imageUrl ?? null,
          parent_id: body.parentId ?? null,
        })
        .select("id")
        .single();

      if (insertError) return json({ error: insertError.message }, 500);

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `,
        )
        .eq("id", inserted.id)
        .single();

      if (postError) return json({ error: postError.message }, 500);
      return json({ post });
    }

    if (body.type === "delete_post") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Verify the user owns the post
      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", body.postId)
        .single();

      if (fetchError) return json({ error: fetchError.message }, 500);
      if (postRow.user_id !== body.userId) return json({ error: "You can only delete your own posts" }, 403);

      const { error: delError } = await supabase
        .from("posts")
        .delete()
        .eq("id", body.postId);

      if (delError) return json({ error: delError.message }, 500);
      return json({ deleted: true });
    }

    if (body.type === "edit_post") {
      if (!body.userId || !body.postId || !body.content?.trim()) {
        return json({ error: "userId, postId, and content are required" }, 400);
      }

      // Verify the user owns the post
      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("user_id, image_url")
        .eq("id", body.postId)
        .single();

      if (fetchError) return json({ error: fetchError.message }, 500);
      if (postRow.user_id !== body.userId) return json({ error: "You can only edit your own posts" }, 403);

      const updateData: { content: string; image_url?: null } = {
        content: body.content.trim(),
      };

      if (body.removeImage) {
        updateData.image_url = null;
      }

      const { data: updatedPost, error: updateError } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", body.postId)
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `)
        .single();

      if (updateError) return json({ error: updateError.message }, 500);
      return json({ post: updatedPost });
    }

    if (body.type === "toggle_like") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      const { data: existing } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", body.userId)
        .eq("post_id", body.postId)
        .maybeSingle();

      const { data: postRow, error: postFetchError } = await supabase
        .from("posts")
        .select("likes_count")
        .eq("id", body.postId)
        .single();

      if (postFetchError) return json({ error: postFetchError.message }, 500);
      const current = postRow.likes_count ?? 0;

      if (existing) {
        const { error: delError } = await supabase
          .from("likes")
          .delete()
          .eq("id", existing.id);
        if (delError) return json({ error: delError.message }, 500);

        const likes_count = Math.max(0, current - 1);
        const { error: updError } = await supabase.from("posts").update({ likes_count }).eq("id", body.postId);
        if (updError) return json({ error: updError.message }, 500);

        return json({ liked: false, likes_count });
      }

      const { error: insError } = await supabase.from("likes").insert({ user_id: body.userId, post_id: body.postId });
      if (insError) return json({ error: insError.message }, 500);

      const likes_count = current + 1;
      const { error: updError } = await supabase.from("posts").update({ likes_count }).eq("id", body.postId);
      if (updError) return json({ error: updError.message }, 500);

      return json({ liked: true, likes_count });
    }

    if (body.type === "toggle_bookmark") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", body.userId)
        .eq("post_id", body.postId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("bookmarks").delete().eq("id", existing.id);
        if (error) return json({ error: error.message }, 500);
        return json({ bookmarked: false });
      }

      const { error } = await supabase.from("bookmarks").insert({ user_id: body.userId, post_id: body.postId });
      if (error) return json({ error: error.message }, 500);
      return json({ bookmarked: true });
    }

    if (body.type === "toggle_repost") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      const { data: existingRepost } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", body.userId)
        .eq("original_post_id", body.postId)
        .eq("is_repost", true)
        .maybeSingle();

      const { data: original, error: originalError } = await supabase
        .from("posts")
        .select("content, image_url, reposts_count")
        .eq("id", body.postId)
        .single();

      if (originalError) return json({ error: originalError.message }, 500);

      const current = original.reposts_count ?? 0;

      if (existingRepost) {
        const { error: delError } = await supabase.from("posts").delete().eq("id", existingRepost.id);
        if (delError) return json({ error: delError.message }, 500);

        const reposts_count = Math.max(0, current - 1);
        const { error: updError } = await supabase.from("posts").update({ reposts_count }).eq("id", body.postId);
        if (updError) return json({ error: updError.message }, 500);

        return json({ reposted: false, reposts_count });
      }

      const { error: insError } = await supabase.from("posts").insert({
        user_id: body.userId,
        content: original.content,
        image_url: original.image_url,
        is_repost: true,
        original_post_id: body.postId,
      });
      if (insError) return json({ error: insError.message }, 500);

      const reposts_count = current + 1;
      const { error: updError } = await supabase.from("posts").update({ reposts_count }).eq("id", body.postId);
      if (updError) return json({ error: updError.message }, 500);

      return json({ reposted: true, reposts_count });
    }

    if (body.type === "track_view") {
      if (!body.postId) return json({ error: "postId is required" }, 400);

      // Determine if it's a UUID or short_id (8-char alphanumeric)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.postId);
      const lookupColumn = isUuid ? "id" : "short_id";

      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("id, views_count")
        .eq(lookupColumn, body.postId)
        .maybeSingle();

      if (fetchError) return json({ error: fetchError.message }, 500);
      if (!postRow) return json({ error: "Post not found" }, 404);

      const views_count = (postRow.views_count ?? 0) + 1;
      const { error: updError } = await supabase
        .from("posts")
        .update({ views_count })
        .eq("id", postRow.id);

      if (updError) return json({ error: updError.message }, 500);

      return json({ views_count });
    }

    if (body.type === "follow_user") {
      if (!body.userId || !body.targetUserId) return json({ error: "userId and targetUserId are required" }, 400);
      if (body.userId === body.targetUserId) return json({ error: "You cannot follow yourself" }, 400);

      // Check if already following
      const { data: existing } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", body.userId)
        .eq("following_id", body.targetUserId)
        .maybeSingle();

      if (existing) {
        return json({ followed: true, message: "Already following" });
      }

      // Insert follow
      const { error: insError } = await supabase.from("follows").insert({
        follower_id: body.userId,
        following_id: body.targetUserId,
      });
      if (insError) return json({ error: insError.message }, 500);

      // Update follower counts
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("followers_count")
        .eq("id", body.targetUserId)
        .single();

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("following_count")
        .eq("id", body.userId)
        .single();

      await supabase
        .from("profiles")
        .update({ followers_count: (targetProfile?.followers_count ?? 0) + 1 })
        .eq("id", body.targetUserId);

      await supabase
        .from("profiles")
        .update({ following_count: (userProfile?.following_count ?? 0) + 1 })
        .eq("id", body.userId);

      return json({ followed: true });
    }

    if (body.type === "verify_user") {
      if (!body.userId || !body.verifiedType) {
        return json({ error: "userId and verifiedType are required" }, 400);
      }

      if (!["blue", "gold"].includes(body.verifiedType)) {
        return json({ error: "verifiedType must be 'blue' or 'gold'" }, 400);
      }

      // Update the user's verified_type
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ verified_type: body.verifiedType })
        .eq("id", body.userId);

      if (updateError) {
        console.error("Failed to update verified_type:", updateError);
        return json({ error: updateError.message }, 500);
      }

      console.log(`User ${body.userId} verified as ${body.verifiedType}`);
      return json({ verified: true, verifiedType: body.verifiedType });
    }

    return json({ error: "Unsupported operation" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in social-write:", error);
    return json({ error: message }, 500);
  }
});
