import { Link } from "wouter";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BLOG_POSTS, formatDate } from "@/data/blog-posts";
import { getSessionToken } from "@/lib/socket";

const CATEGORY_COLORS: Record<string, string> = {
  Infrastructure: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "How-to": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Earning: "bg-primary/10 text-primary border-primary/20",
  Privacy: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export default function Blog() {
  const isLoggedIn = !!getSessionToken();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-[1080px] mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <BeeLogo className="h-7 w-7 text-primary" />
              <span className="font-semibold text-sm">Gigabee</span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-sm text-muted-foreground ml-4">
            <Link href="/chat" className="hover:text-foreground transition-colors">Chat</Link>
            <Link href="/earn" className="hover:text-foreground transition-colors">Earn</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/blog" className="text-foreground font-medium">Blog</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/chat">
                <Button size="sm" className="h-8 text-xs">Open Chat</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm" className="h-8 text-xs">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1080px] mx-auto px-4 pt-16 pb-12">
        <h1 className="text-3xl font-bold tracking-tight">Gigabee Blog</h1>
        <p className="mt-3 text-muted-foreground text-base max-w-xl">
          Deep dives into decentralized AI infrastructure, worker setup guides,
          earnings analysis, and privacy architecture.
        </p>
      </section>

      {/* Posts grid */}
      <section className="max-w-[1080px] mx-auto px-4 pb-24">
        <div className="grid sm:grid-cols-2 gap-6">
          {BLOG_POSTS.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="group h-full rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                      CATEGORY_COLORS[post.category] ?? "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{post.readTime}</span>
                </div>

                <div className="flex-1 space-y-2">
                  <h2 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <time className="text-xs text-muted-foreground" dateTime={post.publishedAt}>
                    {formatDate(post.publishedAt)}
                  </time>
                  <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Read <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-[1080px] mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Gigabee.io</span>
          <div className="flex gap-5">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/chat" className="hover:text-foreground transition-colors">Chat</Link>
            <Link href="/earn" className="hover:text-foreground transition-colors">Earn</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
