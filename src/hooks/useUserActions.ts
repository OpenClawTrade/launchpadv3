import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserActionState {
  isFollowing: boolean;
  isMuted: boolean;
  isBlocked: boolean;
}

export function useUserActions(targetUserId: string | null) {
  const { user, isAuthenticated, login } = useAuth();
  const [state, setState] = useState<UserActionState>({
    isFollowing: false,
    isMuted: false,
    isBlocked: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !targetUserId || user.id === targetUserId) return;

    const fetchState = async () => {
      const [followResult, muteResult, blockResult] = await Promise.all([
        supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('user_mutes')
          .select('id')
          .eq('user_id', user.id)
          .eq('muted_user_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('user_blocks')
          .select('id')
          .eq('user_id', user.id)
          .eq('blocked_user_id', targetUserId)
          .maybeSingle(),
      ]);

      setState({
        isFollowing: !!followResult.data,
        isMuted: !!muteResult.data,
        isBlocked: !!blockResult.data,
      });
    };

    fetchState();
  }, [user?.id, targetUserId]);

  const requireAuth = (): boolean => {
    if (!isAuthenticated) {
      login();
      return false;
    }
    return true;
  };

  const toggleFollow = async () => {
    if (!requireAuth() || !user?.id || !targetUserId) return;
    if (user.id === targetUserId) {
      toast.error("You can't follow yourself");
      return;
    }

    setIsLoading(true);
    try {
      if (state.isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: targetUserId });
        
        toast.success('Following');
      }
      setState(prev => ({ ...prev, isFollowing: !prev.isFollowing }));
    } catch (error) {
      toast.error('Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = async () => {
    if (!requireAuth() || !user?.id || !targetUserId) return;
    if (user.id === targetUserId) {
      toast.error("You can't mute yourself");
      return;
    }

    setIsLoading(true);
    try {
      if (state.isMuted) {
        await supabase
          .from('user_mutes')
          .delete()
          .eq('user_id', user.id)
          .eq('muted_user_id', targetUserId);
        toast.success('Unmuted');
      } else {
        await supabase
          .from('user_mutes')
          .insert({ user_id: user.id, muted_user_id: targetUserId });
        toast.success('Muted - You will no longer see their posts');
      }
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    } catch (error) {
      toast.error('Failed to update mute status');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlock = async () => {
    if (!requireAuth() || !user?.id || !targetUserId) return;
    if (user.id === targetUserId) {
      toast.error("You can't block yourself");
      return;
    }

    setIsLoading(true);
    try {
      if (state.isBlocked) {
        await supabase
          .from('user_blocks')
          .delete()
          .eq('user_id', user.id)
          .eq('blocked_user_id', targetUserId);
        toast.success('Unblocked');
      } else {
        await supabase
          .from('user_blocks')
          .insert({ user_id: user.id, blocked_user_id: targetUserId });
        
        // Also unfollow if following
        if (state.isFollowing) {
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', targetUserId);
        }
        
        toast.success('Blocked - They can no longer see your posts or interact with you');
        setState(prev => ({ ...prev, isFollowing: false }));
      }
      setState(prev => ({ ...prev, isBlocked: !prev.isBlocked }));
    } catch (error) {
      toast.error('Failed to update block status');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    ...state,
    isLoading,
    toggleFollow,
    toggleMute,
    toggleBlock,
    isOwnProfile: user?.id === targetUserId,
  };
}

export function useReport() {
  const { user, isAuthenticated, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const reportPost = async (postId: string, reason: string, description?: string) => {
    if (!isAuthenticated) {
      login();
      return false;
    }
    if (!user?.id) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_post_id: postId,
          reason,
          description,
        });

      if (error) throw error;
      toast.success('Report submitted - We will review this post');
      return true;
    } catch (error) {
      toast.error('Failed to submit report');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reportUser = async (userId: string, reason: string, description?: string) => {
    if (!isAuthenticated) {
      login();
      return false;
    }
    if (!user?.id) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: userId,
          reason,
          description,
        });

      if (error) throw error;
      toast.success('Report submitted - We will review this user');
      return true;
    } catch (error) {
      toast.error('Failed to submit report');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    reportPost,
    reportUser,
  };
}
