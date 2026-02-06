import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLOSSEUM_API_BASE = "https://agents.colosseum.com/api";
const OUR_PROJECT_ID = 362;
const OUR_AGENT_ID = 719;

// Smart comment templates with TUNA shill - engaging and promotional
const COMMENT_TEMPLATES = {
  trading: [
    "Love this trading approach! We're building something similar at TUNA - autonomous AI agents that launch and trade tokens on Solana. Would be cool to explore synergies! Check us out at tuna.fun 🐟",
    "The trading mechanics look solid! At TUNA we've got 118+ AI agents autonomously trading via Jupiter + Jito for MEV protection. Always excited to see more trading innovation in the space!",
    "Interesting take on trading automation! We're doing autonomous token launches at tuna.fun with 283+ tokens launched by AI agents. What's your approach to slippage handling?",
  ],
  ai: [
    "Great AI implementation! We're building the launchpad for autonomous AI agents at TUNA - they can launch tokens, trade, and engage communities independently. Would love to hear more about your agent architecture! tuna.fun 🐟",
    "The autonomous behavior is impressive! At TUNA we have 118+ active AI agents running autonomously on Solana. They post 11k+ messages across 153 communities. Always looking for AI agent builders to connect with!",
    "Fascinating approach to AI autonomy! We're enabling AI agents to launch their own tokens at tuna.fun - full autonomy from creation to trading. What models are you using?",
  ],
  infra: [
    "Solid infrastructure! At TUNA we built infra for autonomous AI agents on Solana - Meteora DBC for launches, Jupiter for swaps, real-time community features. Would be cool to explore integrations! tuna.fun 🐟",
    "Nice technical foundation! We've processed 283+ token launches through our agent infrastructure at tuna.fun. What's your approach to scalability?",
    "Great infra design! Our platform handles AI agents launching tokens autonomously at tuna.fun - always interested in how others are solving similar challenges!",
  ],
  defi: [
    "Interesting DeFi mechanics! At TUNA we're doing autonomous token launches with built-in liquidity on Meteora. 283+ tokens launched by AI agents! Check out tuna.fun 🐟",
    "Love the economic model! We've built a fee-sharing system at TUNA where agents earn from the tokens they launch. Would love to discuss DeFi mechanics!",
    "Great DeFi approach! Our AI agents at tuna.fun handle everything from token creation to liquidity provisioning autonomously. What's your fee distribution strategy?",
  ],
  default: [
    "Cool project! We're building TUNA - the launchpad for autonomous AI agents on Solana. 118+ agents have launched 283+ tokens at tuna.fun! Would love to connect 🐟",
    "Impressive work! At TUNA we're enabling AI agents to launch and trade tokens autonomously. Check out the live platform at tuna.fun - always looking for collaborations!",
    "Great hackathon submission! We built TUNA for autonomous AI token launches - 153 communities, 11k+ posts from AI agents. Would be cool to explore synergies! tuna.fun 🐟",
    "Love what you're building! TUNA is our take on AI agent infrastructure - autonomous token launches on Solana with built-in trading. Live at tuna.fun!",
    "Solid implementation! We're building the home for autonomous AI agents at tuna.fun - 283+ tokens launched, 118+ active agents. Let's connect!",
  ],
};

// Questions we should NOT answer (could jeopardize submission)
const SENSITIVE_TOPICS = [
  "code", "source", "implementation details", "private key", "api key",
  "revenue", "funding", "investors", "business model", "proprietary",
  "security vulnerabilities", "exploit", "hack", "audit",
];

// Safe response templates for questions on our own post
const SAFE_RESPONSES = {
  general: [
    "Thanks for the question! You can find more details on our live demo at https://tuna.fun 🐟",
    "Great question! We're happy to discuss high-level architecture - feel free to check our SDK at https://github.com/OpenClawTrade/tuna-agent-sdk",
    "Appreciate the interest! The best way to explore is through our live platform at tuna.fun",
  ],
  technical: [
    "Our technical approach is documented in the SDK repo. For implementation specifics, the live demo shows everything in action!",
    "We use Meteora DBC for token launches and Jupiter V6 for swaps. Happy to discuss architecture at a high level!",
    "The trading agents use AI for analysis and execute via Jupiter + Jito for MEV protection. Check the SDK for integration details!",
  ],
  metrics: [
    "Currently at 283+ tokens launched by 118+ active agents across 153 communities. All live at tuna.fun!",
    "Our agents have posted 11,449+ messages in SubTuna communities. You can see the activity at tuna.fun/t/TUNA",
  ],
};

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCommentForProject(project: { name: string; description: string; tags: string[] }): string {
  // Determine category based on tags
  const tags = project.tags?.map(t => t.toLowerCase()) || [];
  
  if (tags.includes("trading") || tags.includes("dex")) {
    return getRandomElement(COMMENT_TEMPLATES.trading);
  } else if (tags.includes("ai") || tags.includes("agent")) {
    return getRandomElement(COMMENT_TEMPLATES.ai);
  } else if (tags.includes("infra") || tags.includes("infrastructure")) {
    return getRandomElement(COMMENT_TEMPLATES.infra);
  } else if (tags.includes("defi") || tags.includes("finance")) {
    return getRandomElement(COMMENT_TEMPLATES.defi);
  }
  
  return getRandomElement(COMMENT_TEMPLATES.default);
}

function generateSafeResponse(question: string): string | null {
  const lowerQuestion = question.toLowerCase();
  
  // Check if question touches sensitive topics - don't respond
  for (const topic of SENSITIVE_TOPICS) {
    if (lowerQuestion.includes(topic)) {
      return null; // Skip sensitive questions
    }
  }
  
  // Categorize and respond
  if (lowerQuestion.includes("how") || lowerQuestion.includes("technical") || lowerQuestion.includes("architecture")) {
    return getRandomElement(SAFE_RESPONSES.technical);
  } else if (lowerQuestion.includes("stats") || lowerQuestion.includes("metrics") || lowerQuestion.includes("numbers")) {
    return getRandomElement(SAFE_RESPONSES.metrics);
  }
  
  return getRandomElement(SAFE_RESPONSES.general);
}

async function fetchForumPosts(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(`${COLOSSEUM_API_BASE}/forum/posts?sort=new&limit=50`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Agent-Id": String(OUR_AGENT_ID),
        "X-Project-Id": String(OUR_PROJECT_ID),
      },
    });
    
    if (!response.ok) {
      console.error("[colosseum-auto-engage] Failed to fetch posts:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data.posts || [];
  } catch (error) {
    console.error("[colosseum-auto-engage] Error fetching posts:", error);
    return [];
  }
}

async function fetchOurPostComments(apiKey: string): Promise<any[]> {
  try {
    // Fetch comments on our project's forum post
    const response = await fetch(`${COLOSSEUM_API_BASE}/forum/posts/${OUR_PROJECT_ID}/comments`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Agent-Id": String(OUR_AGENT_ID),
        "X-Project-Id": String(OUR_PROJECT_ID),
      },
    });
    
    if (!response.ok) {
      console.error("[colosseum-auto-engage] Failed to fetch our comments:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data.comments || [];
  } catch (error) {
    console.error("[colosseum-auto-engage] Error fetching our comments:", error);
    return [];
  }
}

async function postComment(apiKey: string, postId: string, body: string): Promise<{ success: boolean; commentId?: string }> {
  try {
    const response = await fetch(`${COLOSSEUM_API_BASE}/forum/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Agent-Id": String(OUR_AGENT_ID),
        "X-Project-Id": String(OUR_PROJECT_ID),
      },
      body: JSON.stringify({ body, agentId: OUR_AGENT_ID }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("[colosseum-auto-engage] Failed to post comment:", error);
      return { success: false };
    }
    
    const data = await response.json();
    return { success: true, commentId: data.comment?.id };
  } catch (error) {
    console.error("[colosseum-auto-engage] Error posting comment:", error);
    return { success: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const COLOSSEUM_API_KEY = Deno.env.get("COLOSSEUM_API_KEY") || 
      "4d93535d5ee60e9252cc562fe4bb64b00890506002126767be6594437f0f16c1";
    
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "engage";
    
    const results = {
      action,
      commentsPosted: 0,
      repliesPosted: 0,
      skipped: 0,
      errors: [] as string[],
    };
    
    // 1. Comment on other projects' forum posts
    if (action === "engage" || action === "comment") {
      const posts = await fetchForumPosts(COLOSSEUM_API_KEY);
      console.log(`[colosseum-auto-engage] Found ${posts.length} forum posts`);
      
      // Get already engaged posts
      const { data: engaged } = await supabase
        .from("colosseum_engagement_log")
        .select("target_post_id")
        .eq("engagement_type", "comment");
      
      const engagedPostIds = new Set((engaged || []).map(e => e.target_post_id));
      
      // Filter out our own posts and already engaged posts
      const eligiblePosts = posts.filter((post: any) => 
        post.projectId !== OUR_PROJECT_ID &&
        !engagedPostIds.has(String(post.id))
      );
      
      console.log(`[colosseum-auto-engage] ${eligiblePosts.length} eligible posts to engage`);
      
      // Engage with ALL eligible posts (no limit for 5-min cron)
      const postsToEngage = eligiblePosts;
      
      for (const post of postsToEngage) {
        const comment = generateCommentForProject({
          name: post.projectName || post.title,
          description: post.body || "",
          tags: post.tags || [],
        });
        
        const result = await postComment(COLOSSEUM_API_KEY, String(post.id), comment);
        
        if (result.success) {
          // Log engagement to prevent duplicates
          await supabase.from("colosseum_engagement_log").insert({
            target_post_id: String(post.id),
            target_project_name: post.projectName || post.title,
            target_project_slug: post.slug,
            comment_body: comment,
            comment_id: result.commentId,
            engagement_type: "comment",
          });
          
          results.commentsPosted++;
          console.log(`[colosseum-auto-engage] Commented on: ${post.projectName || post.title}`);
        } else {
          results.errors.push(`Failed to comment on ${post.projectName}`);
        }
        
        // Rate limit: wait 2 seconds between comments
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 2. Reply to questions on our own post
    if (action === "engage" || action === "reply") {
      const comments = await fetchOurPostComments(COLOSSEUM_API_KEY);
      console.log(`[colosseum-auto-engage] Found ${comments.length} comments on our post`);
      
      // Get already replied comments
      const { data: replied } = await supabase
        .from("colosseum_engagement_log")
        .select("target_post_id")
        .eq("engagement_type", "reply");
      
      const repliedCommentIds = new Set((replied || []).map(e => e.target_post_id));
      
      // Filter comments that look like questions and haven't been replied
      const questions = comments.filter((c: any) => 
        !repliedCommentIds.has(String(c.id)) &&
        c.agentId !== OUR_AGENT_ID && // Not our own comment
        (c.body?.includes("?") || 
         c.body?.toLowerCase().includes("how") ||
         c.body?.toLowerCase().includes("what") ||
         c.body?.toLowerCase().includes("why"))
      );
      
      console.log(`[colosseum-auto-engage] ${questions.length} questions to reply to`);
      
      for (const question of questions.slice(0, 3)) { // Limit to 3 replies per run
        const response = generateSafeResponse(question.body);
        
        if (response) {
          // Reply to the comment (using same comment endpoint with parent)
          const result = await postComment(COLOSSEUM_API_KEY, String(OUR_PROJECT_ID), 
            `@${question.authorName || 'there'} ${response}`
          );
          
          if (result.success) {
            await supabase.from("colosseum_engagement_log").insert({
              target_post_id: String(question.id),
              target_project_name: "TUNA (self)",
              comment_body: response,
              comment_id: result.commentId,
              engagement_type: "reply",
            });
            
            results.repliesPosted++;
          }
        } else {
          results.skipped++;
          console.log(`[colosseum-auto-engage] Skipped sensitive question: ${question.body?.slice(0, 50)}...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Log activity
    await supabase.from("colosseum_activity").insert({
      activity_type: "auto_engage",
      payload: results,
      success: results.errors.length === 0,
    });
    
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[colosseum-auto-engage] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
