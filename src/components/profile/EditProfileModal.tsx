import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, X, Loader2 } from "lucide-react";
import { Profile, ProfileUpdateData } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSave: (data: ProfileUpdateData) => Promise<boolean>;
}

export function EditProfileModal({
  open,
  onOpenChange,
  profile,
  onSave,
}: EditProfileModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: profile.display_name || "",
    bio: profile.bio || "",
    location: profile.location || "",
    website: profile.website || "",
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File, type: 'avatar' | 'cover'): Promise<string | null> => {
    if (!user?.id) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${type}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(`Error uploading ${type}:`, uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;

      // Upload avatar if changed
      if (avatarFile) {
        setIsUploadingAvatar(true);
        const url = await uploadImage(avatarFile, 'avatar');
        if (url) avatarUrl = url;
        setIsUploadingAvatar(false);
      }

      // Upload cover if changed
      if (coverFile) {
        setIsUploadingCover(true);
        const url = await uploadImage(coverFile, 'cover');
        if (url) coverUrl = url;
        setIsUploadingCover(false);
      }

      const success = await onSave({
        display_name: formData.display_name,
        bio: formData.bio || undefined,
        location: formData.location || undefined,
        website: formData.website || undefined,
        avatar_url: avatarUrl || undefined,
        cover_url: coverUrl || undefined,
      });

      if (success) {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
      setIsUploadingAvatar(false);
      setIsUploadingCover(false);
    }
  };

  const isUploading = isUploadingAvatar || isUploadingCover;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-xl font-bold">Edit profile</DialogTitle>
          </div>
          <Button
            className="rounded-full font-bold"
            onClick={handleSubmit}
            disabled={isLoading || isUploading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Cover Photo */}
          <div 
            className="h-32 bg-gradient-to-br from-primary/30 to-primary/10 relative bg-cover bg-center"
            style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}
          >
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
              >
                {isUploadingCover ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </Button>
              {coverPreview && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full bg-black/50 hover:bg-black/70"
                  onClick={() => {
                    setCoverPreview(null);
                    setCoverFile(null);
                  }}
                >
                  <X className="h-5 w-5 text-white" />
                </Button>
              )}
            </div>
          </div>

          {/* Avatar */}
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                    {profile.display_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="rounded-full bg-black/50 hover:bg-black/70 h-10 w-10"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 text-white" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="pt-16 px-4 pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                maxLength={50}
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                maxLength={160}
                rows={3}
                className="bg-transparent resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                maxLength={30}
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="example.com"
                maxLength={100}
                className="bg-transparent"
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
