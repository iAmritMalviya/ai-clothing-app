import Link from "next/link";
import { Sparkles, MessageCircle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Sparkles,
    title: "Instant Processing",
    description:
      "Remove backgrounds from clothing images in seconds using AI",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Ready",
    description:
      "Share processed images directly to WhatsApp with one tap",
  },
  {
    icon: Gift,
    title: "5 Free Images",
    description:
      "Get started with 5 free background removals, no payment required",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Professional Product Photos
          <br />
          <span className="text-primary">in Seconds</span>
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Remove backgrounds from your clothing images instantly.
          Perfect for online stores, WhatsApp catalogs, and social media.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/login">Get Started Free</Link>
        </Button>
      </section>

      <section className="border-t bg-muted/40 px-4 py-16">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <feature.icon className="h-10 w-10 text-primary" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
