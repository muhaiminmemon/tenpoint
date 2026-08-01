import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata = { title: "Terms" };

const LAST_UPDATED = "26 July 2026";

function contactEmail() {
  return process.env.CONTACT_EMAIL ?? SUPPORT_EMAIL;
}

export default function TermsPage() {
  const contact = contactEmail();

  return (
    <article className="mx-auto max-w-2xl py-6">
      <h1 className="display text-3xl">Terms of use</h1>
      <p className="num mt-2 text-sm text-ash">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-paper">
        {APP_NAME} is a free film diary run as a personal project. These terms are short on
        purpose.
      </p>

      <Section title="Your account">
        <p>
          You need to be 13 or older to sign up. Keep your password to yourself; you&apos;re
          responsible for what happens under your account. One person per account, and don&apos;t
          impersonate anyone else.
        </p>
      </Section>

      <Section title="What you write">
        <p>
          Your reviews, lists, and comments stay yours. By posting them here you give us
          permission to store and display them within the product: to you, and to whoever your
          privacy settings allow. That permission ends when you delete the content or your
          account.
        </p>
      </Section>

      <Section title="What's not allowed">
        <List>
          <li>Harassment, threats, hate speech, or targeting someone person-to-person.</li>
          <li>Sexual content involving minors, or anything else illegal where you live.</li>
          <li>Spam, scraping, bulk automated requests, or trying to break the rate limits.</li>
          <li>Attempting to access accounts or data that aren&apos;t yours.</li>
        </List>
        <p className="mt-3">
          There&apos;s a report button on reviews, comments, and profiles. Reports are read by a
          human. Accounts that break these rules can be suspended or removed.
        </p>
      </Section>

      <Section title="Film data">
        <p>
          Film metadata, posters, and backdrops come from{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer"
            className="text-paper underline underline-offset-2"
          >
            TMDB
          </a>{" "}
          and remain subject to their terms. This product uses the TMDB API but is not endorsed or
          certified by TMDB. {APP_NAME} is an independent product and is not affiliated with,
          endorsed by, or connected to Letterboxd in any way. The import and export features
          read and write the CSV files their own tools produce, so that anyone can move a
          history in or out without being held anywhere. That is the whole of the relationship.
          Letterboxd is their trademark, not ours.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          This is provided as-is, with no guarantee of uptime, and no liability for lost data.
          That&apos;s not a licence to be careless, but it is the honest position of a free
          project, which is exactly why{" "}
          <Link href="/settings" className="text-paper underline underline-offset-2">
            export
          </Link>{" "}
          is one click and always free. Keep your own copy if the data matters to you.
        </p>
      </Section>

      <Section title="Changes and endings">
        <p>
          These terms may change; the date at the top will say when. You can delete your account at
          any time from Settings. If this service ever shuts down, there will be notice and time to
          export.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <a href={`mailto:${contact}`} className="text-paper underline underline-offset-2">
            {contact}
          </a>
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="display text-lg text-paper">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-ash">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}
