"use client";

const MONO = "JetBrains Mono, monospace";
const BODY = "var(--font-inter), Inter, system-ui, sans-serif";
const BG = "#1B1815";
const CARD_BG = "#242019";
const BORDER = "#3A332A";
const TEXT_LIGHT = "#E8E0D4";
const TEXT_MID = "#B0A594";
const TEXT_DIM = "rgba(176, 165, 148, 0.75)";
const CARD_GLOW =
  "0 0 24px rgba(184, 115, 51, 0.06), 0 1px 2px rgba(0,0,0,0.2)";
const COPPER = "#B87333";
const GREEN = "rgba(46, 204, 113, 0.7)";

// ── Full transcript data ────────────────────────────────────────────────────

interface Turn {
  speaker: "ARCHITECT" | "AI";
  ts: string;
  text: string;
}

interface Exchange {
  label: string;
  context?: string;
  turns: Turn[];
}

const EXCHANGES: Exchange[] = [
  {
    label: "SETUP",
    turns: [
      {
        speaker: "ARCHITECT",
        ts: "7:37 PM",
        text: "Let\u2019s do a bit of a back and forth, almost like flashcards. I am a licensed architect and designer, so can help you with this. Why don\u2019t you ask me an extended series of questions and my responses will help you derive this scoring. What do you think?",
      },
      {
        speaker: "AI",
        ts: "7:39 PM",
        text: "Great idea. Let\u2019s do it. Your professional eye will make these rubrics far more precise than anything I can derive from literature alone. I\u2019ll work through the axes systematically \u2014 SPACE, then STORY, then STAGE. Each question targets a specific scoring distinction. Answer with whatever comes naturally \u2014 examples, rules of thumb, visual cues, pet peeves. I\u2019ll synthesize your answers into rubric anchors afterward.",
      },
    ],
  },
  {
    label: "Q1 \u2014 GRANDEUR (calibrating the scale)",
    turns: [
      {
        speaker: "AI",
        ts: "7:39 PM",
        text: "You walk into two different homes. Both are expensive. Both are well-designed. But one reads as grand and the other reads as intimate. What are the first three things your eye registers that tell you which is which \u2014 before you even process the furniture or decoration?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:41 PM",
        text: "Grand: high ceilings, glossy materials, gold colors. Intimate: low ceilings, wood, books, clutter.",
      },
    ],
  },
  {
    label: "Q2 \u2014 GRANDEUR (calibrating the middle)",
    turns: [
      {
        speaker: "AI",
        ts: "7:41 PM",
        text: "So a 5 is Versailles \u2014 triple-height, gilded, reflective. A 1 is a book-lined study with 8-foot ceilings. What does a 3 look like?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:42 PM",
        text: "Clean, organized, stuff but it has a home. Furniture is nice and newish.",
      },
    ],
  },
  {
    label: "Q3 \u2014 MATERIAL WARMTH (the spectrum)",
    turns: [
      {
        speaker: "AI",
        ts: "7:42 PM",
        text: "One room is all white marble floors, lacquered surfaces, chrome fixtures. The other is wide-plank oak, linen upholstery, terracotta pots. Between those two poles \u2014 what\u2019s the material combination that sits dead center?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:44 PM",
        text: "Almost like a gallery space, worn wood floors, but clean white walls. Maybe sparse, designer furniture, but zones for sitting and relaxing with fabrics and texture.",
      },
    ],
  },
  {
    label: "Q4 \u2014 MAXIMALISM (what counts)",
    turns: [
      {
        speaker: "AI",
        ts: "7:44 PM",
        text: "A room is packed with objects. How do you distinguish between maximalism that\u2019s designed versus maximalism that\u2019s just stuff? What\u2019s the tell that separates a Mario Buatta explosion from a cluttered grandparent\u2019s house?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:47 PM",
        text: "Harmony in materials and patterns. Are there consistent colors in the rug and wallpaper? Is everything from the same time period? Historic rugs with contemporary wallpaper looks mashed together. Many objects relating to each other in color, texture, pattern, provenance create harmony vs chaos.",
      },
    ],
  },
  {
    label: "Q5 \u2014 HISTORICISM (reading the timeline)",
    turns: [
      {
        speaker: "AI",
        ts: "7:47 PM",
        text: "You walk into a room with a marble fireplace, 18th-century French chairs, and oil portraits on the walls. Immediately reads as \u201Cold.\u201D But as a professional \u2014 how do you tell the difference between a room that\u2019s actually historic versus one designed to look historic?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:49 PM",
        text: "You could look at everything holistically. Is there a window unit AC in the window? Or did they integrate all of the heating and cooling infrastructure and make it disappear. Is the room appropriate for its function? Is it a TV room with Louis XIV chairs?",
      },
    ],
  },
  {
    label: "Q6 \u2014 PROVENANCE (the authenticity signal)",
    turns: [
      {
        speaker: "AI",
        ts: "7:49 PM",
        text: "Two dining rooms. Both have beautiful antique tables. In one, the table has water rings, scratches, a chip in the leg \u2014 it\u2019s been used for generations. In the other, the antique table is pristine, clearly restored, with a protective glass top. Does the wear matter to you as a signal of authenticity?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:51 PM",
        text: "As a collector of fine vintage artifacts, you want to see the patina of time. The fading, the chips, the rings. That truly conveys history. Nothing can be perfect and old. Unless it is a museum.",
      },
    ],
  },
  {
    label: "Q7 \u2014 ECLECTICISM (the mixing principle)",
    turns: [
      {
        speaker: "AI",
        ts: "7:51 PM",
        text: "Some designers \u2014 think Axel Vervoordt, Jacques Grange \u2014 are celebrated for mixing a Roman torso with a Noguchi table and a Malian textile. What makes their mixing work where others feel incoherent?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:53 PM",
        text: "You\u2019re describing a bold, big juxtaposition. The contrast creates drama and intrigue. When a designer is good they can pull this off. Maybe the curves and weight of the Roman torso complement the organic shape of the Noguchi table. That is finding novel pairings. Incoherence comes from mindless jamming together of stuff to fill a space. More patterns, more gallery wall art, more colors, etc.",
      },
    ],
  },
  {
    label: "Q8 \u2014 FORMALITY (the behavioral signal)",
    turns: [
      {
        speaker: "AI",
        ts: "7:53 PM",
        text: "You walk into a room. Without anyone telling you the rules, you know how to behave in it. Some rooms say \u201Ctake your shoes off and curl up.\u201D Others say \u201Cdon\u2019t touch anything.\u201D What are the design elements that enforce formality?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:55 PM",
        text: "Warmth, personal touches, furniture that has been used, floors that have been walked on. Some furniture wants to make you feel small. It can be overscaled, expensive, uncomfortable looking. It is talking to you and telling you that you are the visitor, you are beneath it and the homeowner, so you better take off your damn shoes!",
      },
    ],
  },
  {
    label: "Q9 \u2014 CURATION (the invisible hand)",
    turns: [
      {
        speaker: "AI",
        ts: "7:55 PM",
        text: "Two rooms, both beautiful, both expensive. In one, you can feel the designer \u2014 every object placement feels deliberate. In the other, the room feels like it happened. As a designer yourself \u2014 can you always tell when a room has been \u201Cdesigned\u201D? What gives it away?",
      },
      {
        speaker: "ARCHITECT",
        ts: "7:57 PM",
        text: "Very stylized vignettes \u2014 the lamp and side chair with a few knick-knacks perfectly placed. Symmetrical orientations, layouts that look like they were designed for how they would look in a photo, not how they would actually be used by humans.",
      },
    ],
  },
  {
    label: "Q10 \u2014 THEATRICALITY (the tells)",
    turns: [
      {
        speaker: "AI",
        ts: "7:57 PM",
        text: "This is the axis that captures \u201Ccosplay of wealth.\u201D You\u2019ve been in rooms where everything is expensive but it all feels performed \u2014 like the room is trying to convince you of something. What are the tells?",
      },
      {
        speaker: "ARCHITECT",
        ts: "8:00 PM",
        text: "Brand names, statement appliances and designer furniture. Big statement art by globally known artists (Koons, Warhol, Hirst) with no consistent theme. Pictures of the homeowner with celebrities. Gilding, overdone classicism.",
      },
    ],
  },
  {
    label: "Q11 \u2014 THEATRICALITY (the other end)",
    turns: [
      {
        speaker: "AI",
        ts: "8:00 PM",
        text: "Now flip it. You walk into the home of someone who is clearly very wealthy \u2014 the address alone tells you that. But the room doesn\u2019t perform. What does understated wealth look like?",
      },
      {
        speaker: "ARCHITECT",
        ts: "8:02 PM",
        text: "Older, expensive items. \u201CIf you know you know\u201D expensive furniture that is more low key. A few insanely expensive items like a crazy espresso machine. More about the function, items that make daily life more pleasurable, a spa room. Things that aren\u2019t trendy but timeless.",
      },
    ],
  },
  {
    label: "EDGE CASE 1 \u2014 PALM BEACH MANSION",
    context:
      "A Palm Beach mansion, built in 2010, Mediterranean Revival style. Enormous. Travertine floors, mahogany paneling, crystal chandeliers. Furnished by a top decorator with French antiques. A Basquiat over the fireplace. Photos of the owner with two presidents.",
    turns: [
      {
        speaker: "ARCHITECT",
        ts: "8:06 PM",
        text: "Starting with Grandeur: 5, 2, 4, 3, 1, 4, 5, 5, 5.",
      },
      {
        speaker: "AI",
        ts: "8:07 PM",
        text: "Provenance 1 \u2014 biggest lesson. You can buy French antiques but you can\u2019t buy provenance. Everything arrived in 2010. Nothing accumulated. The building itself has no patina. Provenance is about inheritance, not acquisition. And Historicism 3 \u2014 I was scoring the antiques. You\u2019re scoring the room. Built in 2010, a Basquiat over a faux-historic fireplace \u2014 the anachronisms bleed through.",
      },
    ],
  },
  {
    label: "EDGE CASE 2 \u2014 CONNECTICUT FARMHOUSE",
    context:
      "A 1920s Connecticut stone farmhouse. Low ceilings, wide-plank floors, huge fireplace. Worn leather Chesterfield, a modern Saarinen table, some folk art, stacks of books everywhere. No decorator. La Marzocca espresso machine and a Viking range.",
    turns: [
      {
        speaker: "ARCHITECT",
        ts: "8:11 PM",
        text: "Provenance is a tricky one, the last example could be a 2 because with enough items you could fake it. I\u2019m thinking a Roman and Williams house in Montauk full of antiques but rebuilt last year could be a 3. Now looking at this Edge Case 2: 3\u20134, 5, 2\u20133, 4, 4, 3, 3, 5, 2.",
      },
      {
        speaker: "AI",
        ts: "8:12 PM",
        text: "Grandeur 3\u20134 \u2014 stone construction and a massive fireplace give the building weight even with low ceilings. I was scoring height. You\u2019re scoring substance. And Curation 5 \u2014 I scored it 1. I got this completely wrong.",
      },
    ],
  },
  {
    label: "CURATION CORRECTION \u2014 REDEFINING THE AXIS",
    context:
      "The AI initially scored the Connecticut farmhouse as Curation 1 (no visible designer). The architect scored it 5. The disagreement revealed a fundamental flaw in the axis definition.",
    turns: [
      {
        speaker: "AI",
        ts: "8:12 PM",
        text: "I scored Curation 1 because you told me high curation looks like \u201Cvignettes, symmetry, designed for the camera.\u201D That farmhouse has none of those things. But you gave it a 5. That tells me there are two kinds of curation \u2014 the decorator\u2019s curation and the connoisseur\u2019s curation. Am I reading that right?",
      },
      {
        speaker: "ARCHITECT",
        ts: "8:17 PM",
        text: "Yeah, the Roman and Williams could even potentially be a 4. To your question, yes, absolutely, it is maybe the distinction between the designer\u2019s curation, and the homeowner\u2019s curation. The homeowner in the Connecticut example is living a \u201Ccurated\u201D life. They choose the La Marzocca because they are a connoisseur. For the purposes of this scoring exercise let\u2019s say a 1 is your original understanding. The homeowner is curating for themselves. A 5 is a designer curating for a trendy, global lifestyle that could be anyplace.",
      },
      {
        speaker: "AI",
        ts: "8:17 PM",
        text: "That clarifies everything. Curation isn\u2019t about quality of taste \u2014 it\u2019s about who\u2019s directing the room and who it\u2019s for. Score 1 = self-curated, the homeowner chose everything for personal reasons. Score 5 = designer-directed, audience-facing, publishable, placeless. The Connecticut farmhouse revises from 5 to 1. And the farmhouse owner\u2019s exquisite taste isn\u2019t lost \u2014 it shows up in low Theatricality and high Provenance. The taste is evident precisely because it isn\u2019t performing.",
      },
    ],
  },
  {
    label: "WRAP-UP",
    turns: [
      {
        speaker: "ARCHITECT",
        ts: "8:21 PM",
        text: "I like it! Good work, I enjoyed our back and forth. Now, how do we anticipate this mapping between an AD baseline and an Epstein homeowner?",
      },
    ],
  },
];

// ── Render ────────────────────────────────────────────────────────────────────

function TranscriptLine({ turn }: { turn: Turn }) {
  const isArchitect = turn.speaker === "ARCHITECT";
  return (
    <div className="flex gap-3">
      <div className="flex w-[90px] flex-shrink-0 items-start justify-end gap-2">
        <span
          className="mt-0.5 text-[9px]"
          style={{ fontFamily: MONO, color: TEXT_DIM }}
        >
          {turn.ts}
        </span>
        <span
          className="mt-0.5 text-[9px] font-bold tracking-wider"
          style={{
            fontFamily: MONO,
            color: isArchitect ? GREEN : COPPER,
          }}
        >
          {turn.speaker === "ARCHITECT" ? "ARCH" : "AI"}
        </span>
      </div>
      <p
        className="text-[13px] leading-[1.75]"
        style={{
          fontFamily: BODY,
          color: isArchitect ? TEXT_LIGHT : TEXT_MID,
        }}
      >
        {turn.text}
      </p>
    </div>
  );
}

export function CalibrationTranscript() {
  return (
    <div
      className="relative mx-auto w-full"
      style={{
        maxWidth: "var(--grid-max-width)",
        paddingLeft: "var(--grid-margin)",
        paddingRight: "var(--grid-margin)",
        paddingTop: "80px",
        paddingBottom: "80px",
      }}
    >
      {/* Header */}
      <a
        href="/#aesthetic-methodology"
        className="text-[11px] tracking-wide hover:opacity-80"
        style={{ fontFamily: MONO, color: COPPER }}
      >
        &larr; Back to Methodology
      </a>

      <h1
        className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight"
        style={{ fontFamily: MONO, color: TEXT_LIGHT }}
      >
        CALIBRATION TRANSCRIPT
      </h1>
      <p
        className="mt-2 text-[14px]"
        style={{ fontFamily: BODY, color: TEXT_MID }}
      >
        Adversarial training session between a licensed architect and Claude
        Opus 4.6
      </p>
      <p
        className="mt-1 text-[12px]"
        style={{ fontFamily: MONO, color: TEXT_DIM }}
      >
        February 15, 2026 &middot; 7:37&ndash;8:22 PM EST &middot; 45 minutes
        &middot; 15 exchanges
      </p>

      <div
        className="mt-6"
        style={{ borderTop: `1px solid ${BORDER}` }}
      />

      <p
        className="mt-6 text-[13px] leading-[1.75] md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]"
        style={{ fontFamily: BODY, color: TEXT_MID }}
      >
        The 9-axis scoring instrument was developed through this adversarial
        calibration session. The AI posed 11 questions targeting specific
        scoring distinctions, then presented two hypothetical edge-case homes
        for independent scoring. Every disagreement between the architect and
        AI was resolved into a clearer rubric definition. The complete
        exchange is reproduced below, verbatim.
      </p>

      {/* Full transcript */}
      <div className="mt-10 flex flex-col gap-10 md:max-w-[calc(4*(100%-5*24px)/6+3*24px)]">
        {EXCHANGES.map((exchange, idx) => (
          <div
            key={idx}
            className="rounded border p-6"
            style={{
              backgroundColor: CARD_BG,
              borderColor: BORDER,
              boxShadow: CARD_GLOW,
            }}
          >
            <p
              className="text-[9px] font-bold tracking-widest"
              style={{ fontFamily: MONO, color: COPPER }}
            >
              {exchange.label}
            </p>
            {exchange.context && (
              <p
                className="mt-2 text-[12px] italic leading-[1.7]"
                style={{ fontFamily: BODY, color: TEXT_DIM }}
              >
                {exchange.context}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-4">
              {exchange.turns.map((turn, ti) => (
                <TranscriptLine key={ti} turn={turn} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-10"
        style={{ borderTop: `1px solid ${BORDER}` }}
      />
      <p
        className="mt-4 text-[11px] leading-[1.7]"
        style={{ fontFamily: BODY, color: TEXT_DIM }}
      >
        Source: Claude Code conversation transcript{" "}
        <span style={{ fontFamily: MONO }}>
          c5113cb8-004f-4c68-87ff-dabbcea3376e
        </span>
        , lines 5905&ndash;5972. All architect responses are verbatim. AI
        responses are lightly edited for brevity where noted with
        &ldquo;[&hellip;]&rdquo;.
      </p>
      <a
        href="/#aesthetic-methodology"
        className="mt-4 inline-block text-[11px] tracking-wide hover:opacity-80"
        style={{ fontFamily: MONO, color: COPPER }}
      >
        &larr; Back to Methodology
      </a>
    </div>
  );
}
