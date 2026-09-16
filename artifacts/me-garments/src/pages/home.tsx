import { useGetStorefrontHome, useGetStorefrontStatus } from "@workspace/api-client-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { ErrorState } from "@/components/readiness-state";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Sparkles, ShieldCheck, HeartHandshake, Store, WandSparkles } from "lucide-react";
import { BoyCharacter } from "@/components/illustrations/boy";
import { GirlCharacter } from "@/components/illustrations/girl";
import { useAssistantWidget } from "@/components/assistant-widget";

export default function Home() {
  const { open: openAssistant } = useAssistantWidget();
  const { data: status, isLoading: statusLoading } = useGetStorefrontStatus();
  const { data: homeData, isLoading: homeLoading, error } = useGetStorefrontHome({
    query: {
      enabled: status?.shopifyConnected === true && status?.catalogReady === true,
      queryKey: ['storefrontHome']
    }
  });

  if (statusLoading) {
    return (
      <div className="space-y-12 pb-12">
        <div className="h-[60vh] bg-secondary animate-pulse" />
        <div className="container mx-auto px-4 space-y-8">
          <div className="h-8 bg-muted w-48 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error="Failed to load homepage content." />;
  }

  const catalogReady = status?.shopifyConnected && status?.catalogReady;

  return (
    <div className="flex flex-col min-h-screen">
      {!catalogReady && (
        <div className="border-b border-primary/10 bg-accent px-4 py-3 text-center text-sm text-accent-foreground">
          <span className="font-semibold">The M&E experience is taking shape.</span>{" "}
          Live products, prices, and availability will appear after Shopify is connected.
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-accent pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground leading-tight">
              Little Styles. <span className="text-primary italic">Big Smiles.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0">
              Discover playful, comfortable and stylish outfits made for every little adventure.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-4">
              <Button asChild size="lg" className="rounded-full px-8 w-full sm:w-auto">
                <Link href="/boys">Shop Boys</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 w-full sm:w-auto">
                <Link href="/girls">Shop Girls</Link>
              </Button>
            </div>
          </div>

          <div className="flex-1 flex justify-center items-center gap-4 md:gap-8 w-full max-w-md md:max-w-none">
            <div className="w-1/2 max-w-[240px] animate-in slide-in-from-bottom-8 duration-700">
              <BoyCharacter className="w-full drop-shadow-xl" />
            </div>
            <div className="w-1/2 max-w-[240px] animate-in slide-in-from-bottom-12 duration-1000 delay-150">
              <GirlCharacter className="w-full drop-shadow-xl" />
            </div>
          </div>
        </div>

        {/* Decorative background shape */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-0" />
      </section>

      {/* Trust Surface */}
      <section className="border-y bg-card py-8">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x">
          <div className="flex flex-col items-center text-center p-4 space-y-2">
            <Sparkles className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-bold text-sm">Premium Presentation</h3>
            <p className="text-xs text-muted-foreground">Clear product details with no guesswork.</p>
          </div>
          <div className="flex flex-col items-center text-center p-4 space-y-2">
            <HeartHandshake className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-bold text-sm">Parent-First Shopping</h3>
            <p className="text-xs text-muted-foreground">Simple discovery built around confident choices.</p>
          </div>
          <div className="flex flex-col items-center text-center p-4 space-y-2">
            <ShieldCheck className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-bold text-sm">Shopify Checkout</h3>
            <p className="text-xs text-muted-foreground">Secure checkout through the connected M&E store.</p>
          </div>
        </div>
      </section>

      {/* Merchandising Groups */}
      {!catalogReady ? (
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="rounded-3xl border border-primary/15 bg-white px-6 py-14 text-center shadow-sm md:px-12">
            <Store className="mx-auto mb-5 h-9 w-9 text-primary" />
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Live collection preview</p>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">The rails are ready for real M&E products.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              New arrivals, best sellers, age ranges, occasions, product cards, sizes, prices, and availability are intentionally hidden until Shopify supplies verified catalog data.
            </p>
          </div>
        </section>
      ) : homeLoading ? (
        <div className="container mx-auto px-4 py-16 space-y-16">
          <div className="space-y-6">
            <div className="h-8 bg-muted w-48 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-16 space-y-24">
          {homeData?.groups.map((group) => (
            <section key={group.handle} className="space-y-8">
              <div className="flex items-end justify-between">
                <h2 className="text-3xl font-serif font-bold text-foreground">{group.title}</h2>
                <Link href={`/${group.handle}`} className="hidden sm:flex items-center text-sm font-medium text-primary hover:underline group">
                  View all <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {group.products.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {group.products.slice(0, 4).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="bg-secondary rounded-xl p-12 text-center text-muted-foreground">
                  No products available in this collection yet.
                </div>
              )}

              <div className="sm:hidden pt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/${group.handle}`}>View all {group.title}</Link>
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Categories Banner */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <Link href="/boys" className="group relative h-[300px] rounded-2xl overflow-hidden bg-accent flex items-center justify-center p-8">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
              <BoyCharacter className="absolute -bottom-10 right-0 w-64 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-20 w-full flex flex-col items-start mt-auto">
                <h3 className="text-3xl font-serif font-bold text-white mb-2">Boys Collection</h3>
                <span className="text-white flex items-center group-hover:text-primary transition-colors">
                  Shop Now <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                </span>
              </div>
            </Link>

            <Link href="/girls" className="group relative h-[300px] rounded-2xl overflow-hidden bg-accent flex items-center justify-center p-8">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
              <GirlCharacter className="absolute -bottom-10 right-0 w-64 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-20 w-full flex flex-col items-start mt-auto">
                <h3 className="text-3xl font-serif font-bold text-white mb-2">Girls Collection</h3>
                <span className="text-white flex items-center group-hover:text-primary transition-colors">
                  Shop Now <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 text-primary-foreground md:py-24">
        <div className="container mx-auto grid items-center gap-10 px-4 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/75">M&E Style Assistant</p>
            <h2 className="font-serif text-3xl font-bold md:text-5xl">Tell us the moment. We’ll help find the look.</h2>
            <p className="mt-5 max-w-2xl text-white/80">
              Ask naturally by age, occasion, color, category, and budget. Recommendations only use products found in the connected Shopify catalog.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="mt-8 rounded-full px-8"
              onClick={openAssistant}
            >
              Open AI Assistant
            </Button>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm">
            <WandSparkles className="mb-5 h-8 w-8" />
            <p className="font-serif text-2xl font-semibold">“I need a birthday outfit for my 6-year-old boy under Rs. 5000.”</p>
            <p className="mt-4 text-sm text-white/75">The assistant interprets the request, then searches real inventory. It never invents products.</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Shop by Age", "Only age ranges represented in the live catalog will appear."],
            ["Shop by Occasion", "Birthday, wedding, Eid, school and seasonal edits are driven by verified taxonomy."],
            ["Complete the Look", "Coordinated pieces will be suggested from available M&E products only."]
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border bg-white p-7">
              <h3 className="font-serif text-2xl font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
