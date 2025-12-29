import { useState, useRef, useEffect } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    onEmojiSelect(emoji.native);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
          disabled={disabled}
          type="button"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-none bg-transparent shadow-none" 
        align="start"
        sideOffset={5}
      >
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="dark"
          previewPosition="none"
          skinTonePosition="search"
          maxFrequentRows={2}
          perLine={8}
        />
      </PopoverContent>
    </Popover>
  );
}
