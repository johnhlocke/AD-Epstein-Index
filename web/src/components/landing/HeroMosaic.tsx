import { getHeroMosaicData } from "@/lib/queries";
import { HeroMosaicClient } from "./HeroMosaicClient";

export async function HeroMosaic() {
  const tiles = await getHeroMosaicData();
  return <HeroMosaicClient tiles={tiles} />;
}
