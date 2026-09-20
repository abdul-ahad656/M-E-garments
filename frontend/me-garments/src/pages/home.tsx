import type { CSSProperties } from "react";
import { useGetStorefrontHome, useGetStorefrontStatus } from "@workspace/api-client-react";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Heart, Star, Store, WandSparkles } from "lucide-react";
import { useAssistantWidget } from "@/components/assistant-widget";

const CATEGORIES: {
  href: string;
  label: string;
  image?: string;
  featured?: boolean;
  hanger?: boolean;
}[] = [
  {
    href: "/boys",
    label: "Boys",
    image: "/avatars/boy-category.png",
  },
  {
    href: "/girls",
    label: "Girls",
    image: "/avatars/girl-category.png?v=bow",
  },
  {
    href: "/new-arrivals",
    label: "New Arrivals",
    image: "/avatars/new-arrivals-child.png?v=tracksuit",
  },
  {
    href: "/sale",
    label: "Sale",
    featured: true,
    hanger: true,
  },
];

function HangerIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M32 8c0-3 2.4-5.5 5.4-5.5 2.2 0 4 1.4 4.8 3.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M32 10v8L8 34.5c-1.4 1-0.7 3.5 1.1 3.5h45.8c1.8 0 2.5-2.5 1.1-3.5L32 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShirtIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M16 10 24 14l8-4 8 6-6 5v17H14V21l-6-5 8-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NeedleIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden="true">
      <path
        d="M34 8c3 3 3 7 0 10L14 38l-4-4 20-20c3-3 7-3 10 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 10c2 2 2 4 0 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M10 38c4 2 8 0 10-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ButtonIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="13" cy="13" r="1.1" fill="currentColor" />
      <circle cx="19" cy="13" r="1.1" fill="currentColor" />
      <circle cx="13" cy="19" r="1.1" fill="currentColor" />
      <circle cx="19" cy="19" r="1.1" fill="currentColor" />
    </svg>
  );
}

const DECOR_TYPES = ["star", "heart", "hanger", "needle", "button", "shirt", "dot"] as const;
const DECOR_MOTIONS = [
  "home-float",
  "home-float-delayed",
  "home-float-slow",
  "home-drift",
  "home-drift-delayed",
  "home-twinkle",
  "home-twinkle-delayed",
] as const;

function decorSize(type: (typeof DECOR_TYPES)[number], index: number) {
  if (type === "hanger") return index % 2 === 0 ? "h-11 w-12" : "h-9 w-11";
  if (type === "shirt") return "h-7 w-7";
  if (type === "needle") return "h-7 w-7";
  if (type === "button") return "h-5 w-5";
  if (type === "heart") return index % 2 === 0 ? "h-4 w-4" : "h-3.5 w-3.5";
  if (type === "star") return index % 3 === 0 ? "h-4 w-4" : "h-3 w-3";
  return index % 2 === 0
    ? "h-2 w-2 rounded-full bg-rose-400/55"
    : "h-2.5 w-2.5 rounded-full border border-rose-400/50";
}

function buildDecorItems() {
  const items: {
    type: (typeof DECOR_TYPES)[number];
    className: string;
    left: string;
    top: string;
  }[] = [];
  const columns = [3, 10, 17, 24, 32, 40, 48, 56, 64, 72, 80, 88, 95];
  const rows = [3, 9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93];
  let index = 0;

  for (const top of rows) {
    for (const left of columns) {
      if ((left + top) % 5 === 0) continue;
      const type = DECOR_TYPES[index % DECOR_TYPES.length];
      const motion = DECOR_MOTIONS[index % DECOR_MOTIONS.length];
      items.push({
        type,
        className: `${motion} ${decorSize(type, index)}`,
        left: `${left}%`,
        top: `${top}%`,
      });
      index += 1;
    }
  }

  return items;
}

const PAGE_DECOR = buildDecorItems();

function PageDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 2400"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          className="home-dash-line"
          d="M80 180C180 80 340 60 470 150C600 240 520 320 680 280"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          className="home-dash-line-slow"
          d="M720 90C860 40 1040 80 1120 220"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.32"
        />
        <path
          className="home-dash-line"
          d="M60 780C180 680 340 720 300 860C260 980 120 940 70 860"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          className="home-dash-line-slow"
          d="M980 1400C1080 1320 1180 1400 1120 1540"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          className="home-dash-line"
          d="M140 2000C260 1880 420 1920 380 2080"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.36"
        />
        <path
          className="home-dash-line-slow"
          d="M200 420C340 360 500 440 460 560C420 680 260 640 180 520"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.34"
        />
        <path
          className="home-dash-line"
          d="M700 1100C860 1020 1040 1100 980 1260C920 1400 740 1360 680 1220"
          stroke="hsl(350 96% 43%)"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.32"
        />
      </svg>

      {PAGE_DECOR.map((item, index) => {
        const shared = `absolute text-rose-400/80 ${item.className}`;
        const style = { left: item.left, top: item.top };
        if (item.type === "star") {
          return <Star key={index} className={`${shared} fill-rose-300/50`} style={style} />;
        }
        if (item.type === "heart") {
          return <Heart key={index} className={`${shared} fill-rose-300/45`} style={style} />;
        }
        if (item.type === "hanger") {
          return <HangerIcon key={index} className={shared} style={style} />;
        }
        if (item.type === "needle") {
          return <NeedleIcon key={index} className={shared} style={style} />;
        }
        if (item.type === "button") {
          return <ButtonIcon key={index} className={shared} style={style} />;
        }
        if (item.type === "shirt") {
          return <ShirtIcon key={index} className={shared} style={style} />;
        }
        return <span key={index} className={`absolute ${item.className}`} style={style} />;
      })}
    </div>
  );
}

export default function Home() {
  const { open: openAssistant } = useAssistantWidget();
  const { data: status, isLoading: statusLoading } = useGetStorefrontStatus();
  const { data: homeData, isLoading: homeLoading } = useGetStorefrontHome({
    query: {
      enabled: status?.catalogReady === true,
      queryKey: ["storefrontHome"],
    },
  });

  const catalogReady = status?.catalogReady === true;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#F3E9DF]">
      <PageDecor />
      {!statusLoading && !catalogReady && (
        <div className="relative z-10 border-b border-primary/10 bg-accent px-4 py-3 text-center text-sm text-accent-foreground">
          <span className="font-semibold">The M&E experience is taking shape.</span>{" "}
          Live products, prices, and availability will appear after the catalog is connected.
        </div>
      )}

      <section className="relative z-10 bg-transparent px-4 pb-8 pt-8 md:pb-10 md:pt-12">

        <div className="container relative z-10 mx-auto grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-4">
          <div className="relative z-10 max-w-xl space-y-8 text-center lg:text-left">
            <h1 className="font-serif text-5xl font-bold leading-[0.92] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5.4rem]">
              <span className="block">Little Styles</span>
              <span className="mt-1 block text-primary">Big Smiles</span>
            </h1>
            <div className="flex justify-center lg:justify-start">
              <Button
                asChild
                size="lg"
                className="home-shop-btn h-12 rounded-full px-8 text-base font-semibold shadow-sm transition-transform duration-300"
              >
                <Link href="/new-arrivals">Shop Now</Link>
              </Button>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-3xl">
            <img
              src="/avatars/hero-kids.png?v=bow"
              alt="Children wearing M&E Garments"
              className="relative z-10 mx-auto h-auto w-full max-h-[560px] object-contain object-bottom select-none"
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-transparent px-4 py-16 md:py-20">
        <div className="container mx-auto">
          <div className="mb-10 text-center md:mb-12 md:text-left">
            <h2 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
              Shop by Category
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {CATEGORIES.map((category) => (
              <Link
                key={category.href}
                href={category.href}
                className="group block rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <article
                  className={
                    category.featured
                      ? "relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.75rem] bg-primary text-primary-foreground shadow-[0_10px_30px_-18px_rgba(217,4,41,0.55)] transition-transform duration-300 group-hover:-translate-y-1.5"
                      : "relative aspect-square overflow-hidden rounded-[1.75rem] bg-[#F0E8DD] transition-transform duration-300 group-hover:-translate-y-1.5"
                  }
                >
                  {category.image && (
                    <img
                      src={category.image}
                      alt=""
                      className="absolute inset-x-0 bottom-0 h-[92%] w-full object-contain object-bottom transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  {category.hanger && (
                    <HangerIcon
                      className={
                        category.featured
                          ? "absolute right-5 top-5 h-8 w-10 text-white/80"
                          : "absolute right-5 top-5 h-8 w-10 text-primary/35"
                      }
                    />
                  )}
                  {category.featured && (
                    <span className="relative z-10 font-serif text-3xl font-bold tracking-tight md:text-4xl">
                      {category.label}
                    </span>
                  )}
                </article>
                {!category.featured && (
                  <p className="mt-3 text-center text-sm font-medium text-foreground">
                    {category.label}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {statusLoading || (catalogReady && homeLoading) ? (
        <div className="relative z-10 container mx-auto space-y-16 px-4 py-16">
          <div className="space-y-6">
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      ) : catalogReady ? (
        <div className="relative z-10 container mx-auto space-y-24 px-4 py-16">
          {homeData?.groups.map((group) => (
            <section key={group.handle} className="space-y-8">
              <div className="flex items-end justify-between">
                <h2 className="font-serif text-3xl font-bold text-foreground">{group.title}</h2>
                <Link
                  href={`/${group.handle}`}
                  className="group hidden items-center text-sm font-medium text-primary hover:underline sm:flex"
                >
                  View all{" "}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {group.products.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
                  {group.products.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-secondary p-12 text-center text-muted-foreground">
                  No products available in this collection yet.
                </div>
              )}

              <div className="pt-4 sm:hidden">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/${group.handle}`}>View all {group.title}</Link>
                </Button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="relative z-10 container mx-auto px-4 py-16 md:py-24">
          <div className="rounded-3xl border border-primary/15 bg-white px-6 py-14 text-center shadow-sm md:px-12">
            <Store className="mx-auto mb-5 h-9 w-9 text-primary" />
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Live collection preview
            </p>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">
              The rails are ready for real M&E products.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              New arrivals, best sellers, age ranges, occasions, product cards, sizes, prices, and
              availability are intentionally hidden until the catalog has active products.
            </p>
          </div>
        </section>
      )}

      <section className="relative z-10 bg-primary py-16 text-primary-foreground md:py-24">
        <div className="container mx-auto grid items-center gap-10 px-4 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/75">
              M&E Style Assistant
            </p>
            <h2 className="font-serif text-3xl font-bold md:text-5xl">
              Tell us the moment. We’ll help find the look.
            </h2>
            <p className="mt-5 max-w-2xl text-white/80">
              Ask naturally by age, occasion, color, category, and budget. Recommendations only
              use products found in the live catalog.
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
            <p className="font-serif text-2xl font-semibold">
              “I need a birthday outfit for my 6-year-old boy under Rs. 5000.”
            </p>
            <p className="mt-4 text-sm text-white/75">
              The assistant interprets the request, then searches real inventory. It never invents
              products.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Shop by Age", "Only age ranges represented in the live catalog will appear."],
            [
              "Shop by Occasion",
              "Birthday, wedding, Eid, school and seasonal edits are driven by verified taxonomy.",
            ],
            [
              "Complete the Look",
              "Coordinated pieces will be suggested from available M&E products only.",
            ],
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
