import { useState } from "react";
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
import { Camera, X } from "lucide-react";
import { Profile, ProfileUpdateData } from "@/hooks/useProfile";

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
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile.display_name || "",
    bio: profile.bio || "",
    location: profile.location || "",
    website: profile.website || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const success = await onSave({
      display_name: formData.display_name,
      bio: formData.bio || undefined,
      location: formData.location || undefined,
      website: formData.website || undefined,
    });

    setIsLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

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
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Cover Photo */}
          <div className="h-32 bg-gradient-to-br from-primary/30 to-primary/10 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70"
              >
                <Camera className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>

          {/* Avatar */}
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                    {profile.display_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="rounded-full bg-black/50 hover:bg-black/70 h-10 w-10"
                  >
                    <Camera className="h-4 w-4 text-white" />
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
