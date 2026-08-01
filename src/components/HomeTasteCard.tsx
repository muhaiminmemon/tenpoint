import TasteCardBlank from "./TasteCardBlank";
import TasteCardDeveloping from "./TasteCardDeveloping";
import TasteFoilCard from "./TasteFoilCard";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * Lives on the homepage permanently, not just while onboarding. It develops
 * like film: blank at zero films, naming a taste class by five, then going
 * full tiered-and-foil at `FULL_CARD_THRESHOLD` — same slot the whole time,
 * so the homepage never re-lays-out as someone's history grows.
 */
export default function HomeTasteCard({
  taste,
  username,
  displayName,
  avatarUrl,
  userId,
  memberNumber,
  memberSince,
  hasFriend,
}: {
  taste: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  userId: string;
  memberNumber: number;
  memberSince: number;
  hasFriend: boolean;
}) {
  if (taste.rated === 0) return <TasteCardBlank />;

  if (taste.full) {
    return (
      <TasteFoilCard
        data={taste}
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        userId={userId}
        memberNumber={memberNumber}
        memberSince={memberSince}
        hasFriend={hasFriend}
      />
    );
  }

  return <TasteCardDeveloping data={taste} hasFriend={hasFriend} />;
}
