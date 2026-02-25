import { Separator } from "@/components/ui/separator";

export function Contact() {
  return (
    <section id="contact" className="bg-background pb-20 pt-14">
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--grid-max-width)",
          paddingLeft: "var(--grid-margin)",
          paddingRight: "var(--grid-margin)",
        }}
      >
        {/* Section Header */}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ fontFamily: "futura-pt, sans-serif", color: "#B87333" }}
        >
          Contact
        </p>
        <h2
          className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[0.01em]"
          style={{ fontFamily: "futura-pt, sans-serif" }}
        >
          Get in Touch
        </h2>

        <Separator className="mt-5 mb-8" />

        <p className="font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
          <strong>Author:</strong> John H. Locke, AIA
        </p>
        <p className="mt-3 font-serif text-[15px] leading-[1.75] text-[#1A1A1A]">
          Questions, corrections, or leads?{" "}
          <a
            href="mailto:wheretheylive@proton.me"
            className="underline underline-offset-4 transition-colors hover:opacity-70"
            style={{ color: "#B87333" }}
          >
            wheretheylive@proton.me
          </a>
        </p>
      </div>
    </section>
  );
}
