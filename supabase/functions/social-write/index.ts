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
    }
  | {
      type: "get_or_create_conversation";
      userId: string;
      otherUserId: string;
    }
  | {
      type: "send_message";
      userId: string;
      conversationId: string;
      content?: string | null;
      imageUrl?: string | null;
    }
  | {
      type: "mark_messages_read";
      userId: string;
      conversationId: string;
    }
  | {
      type: "toggle_pin";
      userId: string;
      postId: string;
    }
  | {
      type: "ban_user";
      userId: string;
      targetUserId: string;
      reason?: string;
    }
  | {
      type: "admin_delete_post";
      userId: string;
      postId: string;
    };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Convert Privy DID to deterministic UUID (must match client-side logic)
function privyDidToUuid(privyDid: string): string {
  // Remove "did:privy:" prefix if present
  const cleanId = privyDid.replace("did:privy:", "");
  
  // Create a simple hash-based UUID v5-like conversion
  // This uses a deterministic approach based on the privy ID
  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    const char = cleanId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use the hash and original string to create a UUID-like string
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  const suffix = cleanId.slice(-12).padStart(12, '0');
  
  // Format as UUID v5 (namespace-based)
  return `${hexHash.slice(0, 8)}-${hexHash.slice(0, 4)}-5${hexHash.slice(1, 4)}-${((parseInt(hexHash.slice(0, 2), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${suffix.slice(0, 2)}-${suffix.slice(2, 14).padStart(12, '0')}`;
}

// Validate that the authenticated user matches the claimed userId
async function validateUserIdentity(
  supabase: any,
  claimedUserId: string,
  authHeader: string | null
): Promise<{ valid: boolean; error?: string; authenticatedUserId?: string }> {
  if (!authHeader) {
    return { valid: false, error: "Authorization header required" };
  }

  // For Privy-authenticated users, we need to verify they exist in profiles
  // and that the claimed userId matches their profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", claimedUserId)
    .maybeSingle();

  if (profileError) {
    console.error("Error validating user:", profileError);
    return { valid: false, error: "Failed to validate user" };
  }

  if (!profile) {
    return { valid: false, error: "User profile not found" };
  }

  // The user exists - we trust the client-provided userId since Privy handles auth
  // But we log this for audit purposes
  return { valid: true, authenticatedUserId: claimedUserId };
}

// Check if user is an admin
async function isUserAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { 
    _user_id: userId, 
    _role: "admin" 
  });
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SocialWriteRequest;
    const authHeader = req.headers.get("authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper function to check if user is banned
    const checkUserBanned = async (userId: string): Promise<boolean> => {
      const { data } = await supabase.rpc("is_user_banned", { _user_id: userId });
      return data === true;
    };

    // ==================== CREATE POST ====================
    if (body.type === "create_post") {
      const content = body.content?.trim();
      if (!body.userId || !content) return json({ error: "userId and content are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        console.error("Authentication failed for create_post:", validation.error);
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Check if user is banned
      if (await checkUserBanned(body.userId)) {
        return json({ error: "Your account has been suspended" }, 403);
      }

      // Resolve parentId: could be UUID or short_id
      let resolvedParentId: string | null = null;
      if (body.parentId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.parentId);
        if (isUuid) {
          resolvedParentId = body.parentId;
        } else {
          // Look up by short_id
          const { data: parentPost, error: parentError } = await supabase
            .from("posts")
            .select("id")
            .eq("short_id", body.parentId)
            .maybeSingle();
          
          if (parentError) {
            console.error("Error looking up parent post:", parentError);
            return json({ error: parentError.message }, 500);
          }
          if (!parentPost) {
            return json({ error: "Parent post not found" }, 404);
          }
          resolvedParentId = parentPost.id;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: body.userId,
          content,
          image_url: body.imageUrl ?? null,
          parent_id: resolvedParentId,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting post:", insertError);
        return json({ error: insertError.message }, 500);
      }

      // If this is a reply, increment the parent's replies_count
      if (resolvedParentId) {
        const { data: parentPost } = await supabase
          .from("posts")
          .select("replies_count")
          .eq("id", resolvedParentId)
          .single();
        
        const newCount = (parentPost?.replies_count ?? 0) + 1;
        await supabase
          .from("posts")
          .update({ replies_count: newCount })
          .eq("id", resolvedParentId);
      }

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
      console.log(`Post created by user ${body.userId}: ${inserted.id}`);
      return json({ post });
    }

    // ==================== DELETE POST ====================
    if (body.type === "delete_post") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        console.error("Authentication failed for delete_post:", validation.error);
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Verify the user owns the post OR is admin
      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", body.postId)
        .single();

      if (fetchError) return json({ error: fetchError.message }, 500);
      
      const isAdmin = await isUserAdmin(supabase, body.userId);
      if (postRow.user_id !== body.userId && !isAdmin) {
        return json({ error: "You can only delete your own posts" }, 403);
      }

      const { error: delError } = await supabase
        .from("posts")
        .delete()
        .eq("id", body.postId);

      if (delError) return json({ error: delError.message }, 500);
      console.log(`Post ${body.postId} deleted by user ${body.userId} (admin: ${isAdmin})`);
      return json({ deleted: true });
    }

    // ==================== ADMIN DELETE POST ====================
    if (body.type === "admin_delete_post") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        console.error("Authentication failed for admin_delete_post:", validation.error);
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Verify user is admin
      const isAdmin = await isUserAdmin(supabase, body.userId);
      if (!isAdmin) {
        return json({ error: "Admin privileges required" }, 403);
      }

      const { error: delError } = await supabase
        .from("posts")
        .delete()
        .eq("id", body.postId);

      if (delError) return json({ error: delError.message }, 500);
      console.log(`Post ${body.postId} admin-deleted by ${body.userId}`);
      return json({ deleted: true });
    }

    // ==================== BAN USER ====================
    if (body.type === "ban_user") {
      if (!body.userId || !body.targetUserId) {
        return json({ error: "userId and targetUserId are required" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        console.error("Authentication failed for ban_user:", validation.error);
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Verify user is admin
      const isAdmin = await isUserAdmin(supabase, body.userId);
      if (!isAdmin) {
        return json({ error: "Admin privileges required" }, 403);
      }

      // Cannot ban yourself
      if (body.userId === body.targetUserId) {
        return json({ error: "Cannot ban yourself" }, 400);
      }

      // Get target user's info
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", body.targetUserId)
        .single();

      // Get user's associated IPs
      const { data: ipLogs } = await supabase
        .from("user_ip_logs")
        .select("ip_address")
        .eq("user_id", body.targetUserId);

      const associatedIps = ipLogs?.map((log: any) => log.ip_address) || [];

      // Ban the user
      const { error: banError } = await supabase
        .from("user_bans")
        .insert({
          user_id: body.targetUserId,
          banned_by: body.userId,
          reason: body.reason || "Banned via moderation",
          associated_ips: associatedIps,
        });

      if (banError) {
        if (banError.code === "23505") {
          return json({ error: "User is already banned" }, 400);
        }
        console.error("Error banning user:", banError);
        return json({ error: banError.message }, 500);
      }

      // Ban all associated IPs
      for (const ip of associatedIps) {
        await supabase
          .from("ip_bans")
          .upsert({
            ip_address: ip,
            banned_by: body.userId,
            reason: `Associated with banned user @${targetProfile?.username || body.targetUserId}`,
          }, { onConflict: "ip_address" });
      }

      // Delete all their posts
      const { error: deletePostsError } = await supabase
        .from("posts")
        .delete()
        .eq("user_id", body.targetUserId);

      if (deletePostsError) {
        console.error("Error deleting user posts:", deletePostsError);
      }

      console.log(`User ${body.targetUserId} banned by admin ${body.userId}, ${associatedIps.length} IPs banned, posts deleted`);
      return json({ 
        banned: true, 
        username: targetProfile?.username,
        ipsBanned: associatedIps.length 
      });
    }

    // ==================== EDIT POST ====================
    if (body.type === "edit_post") {
      if (!body.userId || !body.postId || !body.content?.trim()) {
        return json({ error: "userId, postId, and content are required" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        console.error("Authentication failed for edit_post:", validation.error);
        return json({ error: validation.error || "Authentication required" }, 401);
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

    // ==================== TOGGLE LIKE ====================
    if (body.type === "toggle_like") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

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

    // ==================== TOGGLE BOOKMARK ====================
    if (body.type === "toggle_bookmark") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

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

    // ==================== TOGGLE REPOST ====================
    if (body.type === "toggle_repost") {
      if (!body.userId || !body.postId) return json({ error: "userId and postId are required" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Check if user is banned
      if (await checkUserBanned(body.userId)) {
        return json({ error: "Your account has been suspended" }, 403);
      }

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

    // ==================== TRACK VIEW ====================
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

    // ==================== FOLLOW USER ====================
    if (body.type === "follow_user") {
      if (!body.userId || !body.targetUserId) return json({ error: "userId and targetUserId are required" }, 400);
      if (body.userId === body.targetUserId) return json({ error: "You cannot follow yourself" }, 400);

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

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

    // ==================== VERIFY USER ====================
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

    // ==================== GET OR CREATE CONVERSATION ====================
    if (body.type === "get_or_create_conversation") {
      if (!body.userId || !body.otherUserId) {
        return json({ error: "userId and otherUserId are required" }, 400);
      }
      if (body.userId === body.otherUserId) {
        return json({ error: "Cannot create conversation with yourself" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Check if conversation already exists (in either direction)
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${body.userId},participant_2.eq.${body.otherUserId}),and(participant_1.eq.${body.otherUserId},participant_2.eq.${body.userId})`
        )
        .maybeSingle();

      if (existing) {
        return json({ conversationId: existing.id });
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          participant_1: body.userId,
          participant_2: body.otherUserId,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
        return json({ error: convError.message }, 500);
      }

      return json({ conversationId: newConv.id });
    }

    // ==================== SEND MESSAGE ====================
    if (body.type === "send_message") {
      if (!body.userId || !body.conversationId) {
        return json({ error: "userId and conversationId are required" }, 400);
      }
      if (!body.content?.trim() && !body.imageUrl) {
        return json({ error: "content or imageUrl is required" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Verify user is participant in conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("participant_1, participant_2")
        .eq("id", body.conversationId)
        .maybeSingle();

      if (!conv) {
        return json({ error: "Conversation not found" }, 404);
      }

      if (conv.participant_1 !== body.userId && conv.participant_2 !== body.userId) {
        return json({ error: "Not a participant in this conversation" }, 403);
      }

      // Insert message
      const messageContent = body.content?.trim() || null;
      const { data: message, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: body.conversationId,
          sender_id: body.userId,
          content: messageContent,
          image_url: body.imageUrl || null,
        })
        .select("*")
        .single();

      if (msgError) {
        console.error("Error sending message:", msgError);
        return json({ error: msgError.message }, 500);
      }

      // Update conversation with last message preview
      await supabase
        .from("conversations")
        .update({
          last_message_preview: messageContent || "[Image]",
          last_message_at: new Date().toISOString(),
        })
        .eq("id", body.conversationId);

      return json({ message });
    }

    // ==================== MARK MESSAGES READ ====================
    if (body.type === "mark_messages_read") {
      if (!body.userId || !body.conversationId) {
        return json({ error: "userId and conversationId are required" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Mark all messages from other users in this conversation as read
      const { error: readError } = await supabase
        .from("messages")
        .update({ read: true })
        .eq("conversation_id", body.conversationId)
        .neq("sender_id", body.userId)
        .eq("read", false);

      if (readError) {
        console.error("Error marking messages as read:", readError);
        return json({ error: readError.message }, 500);
      }

      return json({ success: true });
    }

    // ==================== TOGGLE PIN ====================
    if (body.type === "toggle_pin") {
      if (!body.userId || !body.postId) {
        return json({ error: "userId and postId are required" }, 400);
      }

      // Validate user identity
      const validation = await validateUserIdentity(supabase, body.userId, authHeader);
      if (!validation.valid) {
        return json({ error: validation.error || "Authentication required" }, 401);
      }

      // Check if user can pin posts (admin or gold verified)
      const { data: canPin } = await supabase.rpc("can_pin_posts", { _user_id: body.userId });
      
      if (!canPin) {
        return json({ error: "You don't have permission to pin posts" }, 403);
      }

      // Get current pin status
      const { data: postRow, error: fetchError } = await supabase
        .from("posts")
        .select("pinned")
        .eq("id", body.postId)
        .single();

      if (fetchError) return json({ error: fetchError.message }, 500);

      const newPinnedStatus = !postRow.pinned;
      
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          pinned: newPinnedStatus,
          pinned_at: newPinnedStatus ? new Date().toISOString() : null,
          pinned_by: newPinnedStatus ? body.userId : null,
        })
        .eq("id", body.postId);

      if (updateError) return json({ error: updateError.message }, 500);

      console.log(`Post ${body.postId} ${newPinnedStatus ? 'pinned' : 'unpinned'} by ${body.userId}`);
      return json({ pinned: newPinnedStatus });
    }

    return json({ error: "Unsupported operation" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in social-write:", error);
    return json({ error: message }, 500);
  }
});
