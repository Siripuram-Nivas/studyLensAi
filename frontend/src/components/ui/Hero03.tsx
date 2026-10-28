import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export type HeroCtaVariant = "default" | "link" | "secondary";
export type HeroCtaSize = "default" | "lg";

export interface HeroCtaProps {
  ctaEnabled: boolean;
  text: string;
  link: string;
  variant?: HeroCtaVariant;
  size?: HeroCtaSize;
}

export interface Hero03Props {
  title: string;
  description: string;
  portraitImage: string;
  portraitAlt?: string;
  animation?: "none" | "subtle";
  primaryCTA: HeroCtaProps;
  secondaryCTA?: HeroCtaProps;
  variant?: "standard" | "compact";
  eyebrow?: string;
  meta?: ReactNode;
  imageNote?: string;
}

const heroMask =
  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%)";

const variantStyles = {
  standard: {
    section: "pt-14 pb-16 sm:pt-20 sm:pb-24",
    title: "text-4xl leading-[1.08] sm:text-5xl md:text-6xl",
    description: "mx-auto max-w-xl text-[15px] leading-7 sm:text-base sm:leading-8",
    header: "gap-5 sm:gap-6",
    content: "gap-12 sm:gap-16",
    portrait: "max-w-3xl",
    media: "aspect-[16/10]",
  },
  compact: {
    section: "pt-12 pb-14 sm:pt-16 sm:pb-20",
    title: "text-3xl leading-[1.1] sm:text-4xl md:text-5xl",
    description: "mx-auto max-w-md text-sm leading-7",
    header: "gap-4",
    content: "gap-10 sm:gap-14",
    portrait: "max-w-2xl",
    media: "aspect-[16/9]",
  },
} as const;

function Cta({ cta }: Readonly<{ cta: HeroCtaProps }>) {
  const variant = cta.variant ?? "default";
  const isLarge = cta.size === "lg";

  const className = cn(
    "group inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-500",
    isLarge ? "h-12 text-[15px]" : "h-11 text-sm",
    variant === "default" &&
      cn(
        "bg-iris-600 text-white shadow-sm hover:bg-iris-700 active:bg-iris-800",
        isLarge ? "px-6" : "px-5",
      ),
    variant === "secondary" &&
      cn(
        "border border-ink-200 bg-white text-ink-800 shadow-sm hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100",
        isLarge ? "px-6" : "px-5",
      ),
    variant === "link" && "px-1 text-ink-700 hover:text-ink-950",
  );

  const content = (
    <>
      {cta.text}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  );

  if (!cta.link) {
    return <span className={cn(className, "cursor-default")}>{content}</span>;
  }

  if (cta.link.startsWith("/")) {
    return (
      <Link to={cta.link} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={cta.link} className={className}>
      {content}
    </a>
  );
}

export function Hero03({
  title,
  description,
  portraitImage,
  portraitAlt = "",
  animation = "none",
  primaryCTA,
  secondaryCTA,
  variant = "standard",
  eyebrow,
  meta,
  imageNote,
}: Readonly<Hero03Props>) {
  const headingId = useId();
  const animate = animation === "subtle";
  const vs = variantStyles[variant];

  const reveal = (delay: number): CSSProperties | undefined =>
    animate ? { animationDelay: `${delay}ms` } : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate w-full overflow-hidden bg-canvas"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[560px] bg-[radial-gradient(60%_55%_at_50%_0%,rgba(132,96,244,0.16),transparent_72%)]"
      />

      <div
        className={cn(
          "relative z-10 mx-auto flex max-w-6xl flex-col px-4 sm:px-6",
          vs.section,
          vs.content,
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-3xl flex-col items-center text-center",
            vs.header,
          )}
        >
          {eyebrow && (
            <p
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-iris-200 bg-white px-3 py-1 text-[11px] font-semibold text-iris-700 shadow-sm",
                animate && "animate-hero-rise",
              )}
              style={reveal(0)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-iris-500" aria-hidden="true" />
              {eyebrow}
            </p>
          )}

          <h1
            id={headingId}
            className={cn(
              "text-balance font-serif font-normal tracking-tight text-ink-950",
              vs.title,
              animate && "animate-hero-rise",
            )}
            style={reveal(70)}
          >
            {title}
          </h1>

          <p
            className={cn(
              "text-balance text-ink-600",
              vs.description,
              animate && "animate-hero-rise",
            )}
            style={reveal(140)}
          >
            {description}
          </p>

          {(primaryCTA?.ctaEnabled || secondaryCTA?.ctaEnabled) && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-x-5 gap-y-3",
                animate && "animate-hero-rise",
              )}
              style={reveal(210)}
            >
              {primaryCTA?.ctaEnabled && <Cta cta={primaryCTA} />}
              {secondaryCTA?.ctaEnabled && (
                <Cta
                  cta={{ ...secondaryCTA, variant: secondaryCTA.variant ?? "link" }}
                />
              )}
            </div>
          )}

          {meta && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-ink-500",
                animate && "animate-hero-rise",
              )}
              style={reveal(280)}
            >
              {meta}
            </div>
          )}
        </div>

        {portraitImage && (
          <figure
            className={cn("w-full", animate && "animate-hero-media")}
            style={reveal(320)}
          >
            <div className={cn("relative mx-auto w-full", vs.portrait)}>
              <div
                className="relative z-10 mx-auto w-full overflow-hidden"
                style={{
                  maskImage: heroMask,
                  WebkitMaskImage: heroMask,
                  maskComposite: "intersect",
                  WebkitMaskComposite: "source-in",
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 bg-iris-500/10 mix-blend-multiply"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-canvas/40 via-transparent to-canvas/20"
                />
                <img
                  src={portraitImage}
                  alt={portraitAlt}
                  decoding="async"
                  loading="eager"
                  width={1600}
                  height={1000}
                  className={cn(
                    "relative w-full object-cover object-center",
                    vs.media,
                  )}
                />
              </div>
            </div>

            {imageNote && (
              <figcaption className="mt-4 text-center text-[11px] text-ink-400">
                {imageNote}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}

export default Hero03;
