import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "wouter";
import { useQueryShoppingAssistant, type Product } from "@workspace/api-client-react";
import { Bot, MessageCircle, Send, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
};

type AssistantWidgetContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const AssistantWidgetContext = createContext<AssistantWidgetContextValue | null>(null);

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your M&E shopping assistant. I can help you find the perfect outfit for any occasion. What are you looking for today?",
};

export function useAssistantWidget() {
  const context = useContext(AssistantWidgetContext);
  if (!context) {
    throw new Error("useAssistantWidget must be used within AssistantWidgetProvider");
  }
  return context;
}

export function AssistantWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);

  return (
    <AssistantWidgetContext.Provider value={{ open, close, toggle, isOpen }}>
      {children}
      <AssistantWidgetPanel />
    </AssistantWidgetContext.Provider>
  );
}

function AssistantWidgetPanel() {
  const { isOpen, open, close, toggle } = useAssistantWidget();
  const [location] = useLocation();
  const hideOnAdmin = location.startsWith("/admin");

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assistantMutation = useQueryShoppingAssistant();
  const mutateFnRef = useRef(assistantMutation.mutate);
  mutateFnRef.current = assistantMutation.mutate;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, assistantMutation.isPending]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (hideOnAdmin) return null;

  const handleSend = () => {
    if (!input.trim() || assistantMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    mutateFnRef.current(
      {
        data: {
          message: userMessage.content,
          conversationId,
        },
      },
      {
        onSuccess: (data) => {
          setConversationId(data.conversationId);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: data.message,
              products: data.products,
            },
          ]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content:
                "I'm sorry, I'm having trouble connecting to the store right now. Please try again in a moment.",
            },
          ]);
        },
      },
    );
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div
          className="pointer-events-auto flex h-[min(34rem,calc(100dvh-6.5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          role="dialog"
          aria-label="AI shopping assistant"
        >
          <div className="flex items-center justify-between gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">M&E Assistant</p>
                <p className="truncate text-xs text-primary-foreground/80">Ask about kidswear</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={close}
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-foreground text-background"
                        : "rounded-tl-sm bg-secondary text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.products && msg.products.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {msg.products.map((product) => (
                        <CompactProductCard
                          key={product.id}
                          product={product}
                          onNavigate={close}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-3.5 w-3.5 text-foreground" />
                  </div>
                )}
              </div>
            ))}
            {assistantMutation.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:75ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t bg-background p-3"
          >
            <div className="relative flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for outfits, sizes…"
                className="flex-1 rounded-full py-5 pr-12"
                disabled={assistantMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1.5 top-1.5 bottom-1.5 h-auto rounded-full"
                disabled={!input.trim() || assistantMutation.isPending}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        onClick={isOpen ? toggle : open}
        className="pointer-events-auto h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}

function CompactProductCard({
  product,
  onNavigate,
}: {
  product: Product;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={`/product/${product.handle}`}
      onClick={onNavigate}
      className="w-28 shrink-0 overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary"
    >
      <div className="aspect-[4/5] bg-secondary">
        {product.image ? (
          <img
            src={product.image.url}
            alt={product.image.altText || product.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
          {product.title}
        </p>
        <p className="text-[11px] font-semibold text-foreground">
          {product.price.currencyCode} {product.price.amount}
        </p>
      </div>
    </Link>
  );
}
