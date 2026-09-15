import { useState, useRef, useEffect } from "react";
import { useQueryShoppingAssistant, type Product } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, User, Send } from "lucide-react";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
};

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your M&E shopping assistant. I can help you find the perfect outfit for any occasion. What are you looking for today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const assistantMutation = useQueryShoppingAssistant();
  const mutateFnRef = useRef(assistantMutation.mutate);
  mutateFnRef.current = assistantMutation.mutate;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    mutateFnRef.current({
      data: {
        message: userMessage.content,
        conversationId: conversationId
      }
    }, {
      onSuccess: (data) => {
        setConversationId(data.conversationId);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          products: data.products
        }]);
      },
      onError: () => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I'm having trouble connecting to the store right now. Please try again in a moment."
        }]);
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl min-h-[calc(100vh-16rem)] flex flex-col">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-accent rounded-full mb-4 shadow-sm">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground">AI Shopping Assistant</h1>
        <p className="text-muted-foreground mt-2">Personalized recommendations for your little ones.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden bg-card border-card-border shadow-md">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
        >
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-4 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-foreground text-background rounded-tr-none' : 'bg-secondary text-foreground rounded-tl-none'}`}>
                  <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.content}</p>
                </div>

                {msg.products && msg.products.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                    {msg.products.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-foreground" />
                </div>
              )}
            </div>
          ))}
          {assistantMutation.isPending && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-secondary p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-75" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-background border-t">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 relative"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for winter outfits, party dresses..."
              className="flex-1 pr-12 py-6 rounded-full"
              disabled={assistantMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1.5 top-1.5 bottom-1.5 h-auto rounded-full bg-primary hover:bg-primary/90"
              disabled={!input.trim() || assistantMutation.isPending}
            >
              <Send className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
