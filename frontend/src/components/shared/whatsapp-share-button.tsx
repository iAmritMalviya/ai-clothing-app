import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsAppShareButtonProps {
  imageUrl: string;
  text?: string;
}

export function WhatsAppShareButton({
  imageUrl,
  text = "Check out this product image!",
}: WhatsAppShareButtonProps) {
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${imageUrl}`)}`;

  return (
    <Button asChild className="bg-[#25D366] text-white hover:bg-[#1da851]">
      <a href={shareUrl} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="mr-2 h-4 w-4" />
        Share on WhatsApp
      </a>
    </Button>
  );
}
