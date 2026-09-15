import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import {
  useListWishlistItems,
  useSaveWishlistItem,
  useDeleteWishlistItem,
  getListWishlistItemsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface FavoriteButtonProps {
  productId: string;
  productHandle: string;
  location?: "product_card" | "product_detail" | "wishlist" | "recently_viewed";
  className?: string;
  iconClassName?: string;
}

export function FavoriteButton({
  productId,
  productHandle,
  location = "product_card",
  className,
  iconClassName,
}: FavoriteButtonProps) {
  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wishlist, isLoading: isWishlistLoading } = useListWishlistItems({
    query: { enabled: !!isSignedIn, queryKey: getListWishlistItemsQueryKey() }
  });

  const saveItem = useSaveWishlistItem();
  const deleteItem = useDeleteWishlistItem();

  const isSaved = wishlist?.some(item => item.shopifyProductId === productId);
  const [isHovered, setIsHovered] = useState(false);

  const isPending = saveItem.isPending || deleteItem.isPending || (isSignedIn && isWishlistLoading);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Stop navigation if in a link
    e.stopPropagation();

    if (!isSignedIn) {
      toast({
        title: "Sign in to save favorites",
        description: "Create an account or sign in to save items you love.",
        action: (
          <button
            onClick={() => setLocation('/sign-in')}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Sign In
          </button>
        )
      });
      return;
    }

    if (isPending) return;

    if (isSaved) {
      deleteItem.mutate({ params: { shopifyProductId: productId } }, {
        onSuccess: () => {
          queryClient.setQueryData(getListWishlistItemsQueryKey(), (old: any) => {
            if (!old) return old;
            return old.filter((item: any) => item.shopifyProductId !== productId);
          });
          trackEvent("favorite_removed", { location });
        },
        onError: () => {
          toast({ title: "Error removing item", variant: "destructive" });
        }
      });
    } else {
      saveItem.mutate({ data: { shopifyProductId: productId, productHandle } }, {
        onSuccess: (newItem) => {
          queryClient.setQueryData(getListWishlistItemsQueryKey(), (old: any) => {
            if (!old) return [newItem];
            return [...old, newItem];
          });
          trackEvent("favorite_added", { location });
        },
        onError: () => {
          toast({ title: "Error saving item", variant: "destructive" });
        }
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isPending}
      className={cn(
        "p-2 rounded-full transition-all duration-200 hover:scale-110",
        isSaved ? "bg-primary/10 text-primary" : "bg-white/80 backdrop-blur-sm text-foreground hover:text-primary shadow-sm hover:shadow",
        isPending && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={cn(
          "w-5 h-5 transition-colors",
          (isSaved || isHovered) ? "fill-current" : "fill-none",
          iconClassName
        )}
      />
    </button>
  );
}