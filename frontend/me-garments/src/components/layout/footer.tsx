import { Link } from "wouter";
import { useAssistantWidget } from "@/components/assistant-widget";

export function Footer() {
  const { open: openAssistant } = useAssistantWidget();

  return (
    <footer className="bg-secondary mt-auto border-t">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold text-primary">M&E Garments</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Premium kidswear designed for discovery. Where children find style and parents shop with confidence.
            </p>
            <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
              <p>M&E 2nd Floor Al karim Mall Karim Block Market Allama Iqbal Town Lahore.</p>
              <p>
                Contact #{" "}
                <a href="tel:03014453922" className="hover:text-primary transition-colors">
                  03014453922
                </a>
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/new-arrivals" className="hover:text-primary transition-colors">New Arrivals</Link></li>
              <li><Link href="/best-sellers" className="hover:text-primary transition-colors">Best Sellers</Link></li>
              <li><Link href="/boys" className="hover:text-primary transition-colors">Boys</Link></li>
              <li><Link href="/girls" className="hover:text-primary transition-colors">Girls</Link></li>
              <li><Link href="/sale" className="hover:text-primary transition-colors">Sale</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Discover</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/age/toddler" className="hover:text-primary transition-colors">Toddler (1-3y)</Link></li>
              <li><Link href="/age/kids" className="hover:text-primary transition-colors">Kids (4-8y)</Link></li>
              <li><Link href="/occasion/party" className="hover:text-primary transition-colors">Partywear</Link></li>
              <li>
                <button
                  type="button"
                  onClick={openAssistant}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  Shopping Assistant <span className="text-primary text-[10px]">AI</span>
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/account" className="hover:text-primary transition-colors">My Account</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Shipping & Returns</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Size Guide</Link></li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <img
              src="/indigo-logo.png"
              alt="Indigo Tech Solutions"
              className="h-7 w-7 object-contain mix-blend-multiply"
            />
            <span>Powered by Indigo Tech Solutions</span>
          </p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
