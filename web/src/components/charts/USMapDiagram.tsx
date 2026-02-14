"use client";

const COPPER = "#B87333";

/**
 * City coordinates mapped to the usa-dots.png image (461 x 331 px).
 *
 * Calibrated against visible landmarks in the dotted map:
 *   Seattle ≈ (48, 30),  Maine ≈ (420, 32),
 *   San Diego ≈ (62, 222), Miami ≈ (382, 282),
 *   Chicago ≈ (290, 100), Denver ≈ (155, 130).
 */
const CITY_COORDS: Record<string, { x: number; y: number }> = {
  // East coast
  "new york": { x: 400, y: 112 },
  "new york city": { x: 400, y: 112 },
  "manhattan": { x: 400, y: 112 },
  "brooklyn": { x: 402, y: 114 },
  "greenwich": { x: 394, y: 106 },
  "westchester": { x: 396, y: 104 },
  "hamptons": { x: 414, y: 108 },
  "montauk": { x: 420, y: 106 },
  "martha's vineyard": { x: 424, y: 96 },
  "nantucket": { x: 428, y: 92 },
  "boston": { x: 418, y: 88 },
  "washington": { x: 378, y: 138 },
  "washington dc": { x: 378, y: 138 },
  "washington, d.c.": { x: 378, y: 138 },
  "philadelphia": { x: 390, y: 126 },
  // Florida
  "palm beach": { x: 370, y: 262 },
  "miami": { x: 372, y: 278 },
  "naples": { x: 354, y: 272 },
  "jupiter": { x: 368, y: 256 },
  "key west": { x: 352, y: 288 },
  "boca raton": { x: 370, y: 268 },
  "fort lauderdale": { x: 372, y: 272 },
  // West coast
  "los angeles": { x: 60, y: 196 },
  "beverly hills": { x: 58, y: 194 },
  "bel air": { x: 56, y: 192 },
  "bel-air": { x: 56, y: 192 },
  "malibu": { x: 52, y: 194 },
  "pacific palisades": { x: 54, y: 194 },
  "santa monica": { x: 56, y: 196 },
  "hollywood": { x: 60, y: 194 },
  "san francisco": { x: 42, y: 148 },
  "santa barbara": { x: 50, y: 188 },
  "montecito": { x: 48, y: 188 },
  "palm springs": { x: 74, y: 204 },
  "san diego": { x: 62, y: 218 },
  "carmel": { x: 40, y: 162 },
  // Interior
  "aspen": { x: 150, y: 146 },
  "dallas": { x: 210, y: 218 },
  "houston": { x: 214, y: 236 },
  "chicago": { x: 290, y: 100 },
  "atlanta": { x: 324, y: 198 },
  "nashville": { x: 308, y: 180 },
  "austin": { x: 200, y: 232 },
  "denver": { x: 155, y: 132 },
  "scottsdale": { x: 106, y: 200 },
  "phoenix": { x: 108, y: 204 },
  "seattle": { x: 48, y: 30 },
  "portland": { x: 42, y: 52 },
  "minneapolis": { x: 252, y: 68 },
  "detroit": { x: 310, y: 94 },
  "charleston": { x: 354, y: 200 },
  "savannah": { x: 346, y: 208 },
  // Connecticut
  "connecticut": { x: 398, y: 102 },
  "new canaan": { x: 396, y: 104 },
  "darien": { x: 398, y: 104 },
  "stamford": { x: 396, y: 106 },
};

/** State-level fallback coordinates */
const STATE_COORDS: Record<string, { x: number; y: number }> = {
  "new york": { x: 392, y: 106 },
  "california": { x: 56, y: 182 },
  "florida": { x: 360, y: 260 },
  "texas": { x: 200, y: 226 },
  "connecticut": { x: 398, y: 102 },
  "massachusetts": { x: 418, y: 92 },
  "illinois": { x: 286, y: 112 },
  "colorado": { x: 155, y: 140 },
  "arizona": { x: 108, y: 198 },
  "georgia": { x: 330, y: 204 },
  "virginia": { x: 368, y: 150 },
  "new jersey": { x: 396, y: 122 },
  "maryland": { x: 380, y: 136 },
  "pennsylvania": { x: 376, y: 118 },
  "ohio": { x: 326, y: 114 },
  "michigan": { x: 304, y: 84 },
  "washington": { x: 48, y: 34 },
  "oregon": { x: 42, y: 56 },
  "tennessee": { x: 308, y: 182 },
  "south carolina": { x: 348, y: 198 },
  "north carolina": { x: 362, y: 180 },
  "louisiana": { x: 250, y: 242 },
  "montana": { x: 142, y: 46 },
  "wyoming": { x: 152, y: 76 },
  "utah": { x: 118, y: 146 },
  "nevada": { x: 80, y: 148 },
  "new mexico": { x: 130, y: 206 },
  "minnesota": { x: 252, y: 68 },
  "rhode island": { x: 416, y: 98 },
};

interface LocationDot {
  personName: string;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
}

function resolveCoords(
  city: string | null,
  state: string | null,
): { x: number; y: number } | null {
  if (city) {
    const cityKey = city.toLowerCase().trim();
    if (CITY_COORDS[cityKey]) return CITY_COORDS[cityKey];
  }

  if (city && state) {
    const combo = `${city}, ${state}`.toLowerCase().trim();
    if (CITY_COORDS[combo]) return CITY_COORDS[combo];
  }

  if (state) {
    const stateKey = state.toLowerCase().trim();
    if (STATE_COORDS[stateKey]) return STATE_COORDS[stateKey];
  }

  return null;
}

interface USMapDiagramProps {
  locations: LocationDot[];
}

/**
 * Dotted US map with semi-transparent copper location markers.
 *
 * Uses a stippled PNG base map (461 x 331) with SVG overlay for dots.
 * City/state geocoding from a static lookup table — no external API.
 */
export function USMapDiagram({ locations }: USMapDiagramProps) {
  const dots = locations
    .map((loc) => {
      const coords = resolveCoords(loc.locationCity, loc.locationState);
      if (!coords) return null;
      return { ...loc, ...coords };
    })
    .filter(Boolean) as (LocationDot & { x: number; y: number })[];

  // Deduplicate by coordinate — bigger dot for overlapping locations
  const uniqueDots = new Map<
    string,
    { x: number; y: number; count: number; names: string[] }
  >();
  for (const d of dots) {
    const key = `${d.x},${d.y}`;
    if (!uniqueDots.has(key)) {
      uniqueDots.set(key, { x: d.x, y: d.y, count: 0, names: [] });
    }
    const entry = uniqueDots.get(key)!;
    entry.count++;
    entry.names.push(d.personName);
  }

  return (
    <div
      className="relative h-[340px] overflow-hidden rounded border border-border shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      {/* SVG overlay: PNG background + copper dots */}
      <svg
        viewBox="0 0 461 331"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dotted US map as background image */}
        <image
          href="/usa-dots.png"
          x={0}
          y={0}
          width={461}
          height={331}
          opacity={0.35}
        />

        {/* Location dots */}
        {Array.from(uniqueDots.values()).map((dot, i) => {
          const baseR = 8;
          const r = baseR + dot.count * 4;
          return (
            <g key={i}>
              <circle
                cx={dot.x}
                cy={dot.y}
                r={r}
                fill={COPPER}
                fillOpacity={0.35}
                stroke={COPPER}
                strokeOpacity={0.2}
                strokeWidth={0.5}
              />
              <title>{dot.names.join(", ")}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
