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

      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("views_count")
        .eq("id", body.postId)
        .single();

      if (fetchError) return json({ error: fetchError.message }, 500);

      const views_count = (postRow.views_count ?? 0) + 1;
      const { error: updError } = await supabase
        .from("posts")
        .update({ views_count })
        .eq("id", body.postId);

      if (updError) return json({ error: updError.message }, 500);

      return json({ views_count });
    }

    return json({ error: "Unsupported operation" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in social-write:", error);
    return json({ error: message }, 500);
  }
});
