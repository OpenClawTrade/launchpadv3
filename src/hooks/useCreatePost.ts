import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreatePostInput {
  subtunaId: string;
  authorId: string;
  title: string;
  content?: string;
  imageUrl?: string;
  linkUrl?: string;
  postType: "text" | "image" | "link";
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const { data, error } = await supabase
        .from("subtuna_posts")
        .insert({
          subtuna_id: input.subtunaId,
          author_id: input.authorId,
          title: input.title,
          content: input.content || null,
          image_url: input.imageUrl || null,
          link_url: input.linkUrl || null,
          post_type: input.postType,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
      // Invalidate subtuna to update post count
      if (data.subtuna_id) {
        queryClient.invalidateQueries({ queryKey: ["subtuna", data.subtuna_id] });
      }
    },
  });

  return {
    createPost: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
