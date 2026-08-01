import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata = { title: "Privacy" };

/**
 * Written against what the code actually does, not a template. If a data
 * practice changes, this page changes with it — every claim below is checkable
 * against a specific table in `src/db/schema.ts` or route in `src/app/api`.
 */
const LAST_UPDATED = "26 July 2026";

function contactEmail() {
  return process.env.CONTACT_EMAIL ?? SUPPORT_EMAIL;
}

export default function PrivacyPage() {
  const contact = contactEmail();

  return (
    <article className="mx-auto max-w-2xl py-6">
      <h1 className="display text-3xl">Privacy</h1>
      <p className="num mt-2 text-sm text-ash">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-paper">
        {APP_NAME} is a film diary. It stores what you tell it about films you&apos;ve watched, and
        nothing else. No advertising, no tracking pixels, no analytics scripts, no data sold or
        shared with anyone.
      </p>

      <Section title="What's stored">
        <List>
          <li>
            <strong className="text-paper">Your account</strong>: username, email address, a
            display name and bio if you set them, and your password, hashed with scrypt and a
            per-account salt and never stored in a form anyone can read.
          </li>
          <li>
            <strong className="text-paper">Your diary</strong>: every viewing you log. Film, date,
            rating, review text, and whether you marked it a rewatch, a spoiler, or private.
          </li>
          <li>
            <strong className="text-paper">Your lists</strong>: watchlist, favourites, custom and
            shared lists, and the manual ordering you drag things into.
          </li>
          <li>
            <strong className="text-paper">Your connections</strong>: friendships, pending friend
            requests, blocks, and comments you write.
          </li>
          <li>
            <strong className="text-paper">A profile photo</strong>, if you upload one.
          </li>
          <li>
            <strong className="text-paper">Sessions</strong>: a random token per signed-in device,
            stored hashed, expiring after 90 days.
          </li>
        </List>
      </Section>

      <Section title="What isn't">
        <List>
          <li>No IP address logs, page-view history, or behavioural profile.</li>
          <li>No third-party analytics or advertising code. There is none in the page.</li>
          <li>No payment details, because nothing here costs money.</li>
        </List>
        <p className="mt-3">
          Rate limiting holds a counter against your IP address in server memory for a few minutes
          at a time to stop abuse. It is never written to the database and does not survive a
          restart.
        </p>
      </Section>

      <Section title="Who can see what">
        <p>
          Your profile visibility is yours to set: <em>public</em>, <em>friends only</em>, or{" "}
          <em>private</em>. Individual diary entries can be marked private, which excludes them
          from your public library, the feed, film pages, and any file you export to another
          service. You can also hide your diary or watchlist from your profile independently, and
          turn comments off entirely.
        </p>
        <p className="mt-3">
          Blocking someone makes you mutually invisible: neither of you appears in the other&apos;s
          search results, profile pages, or comment threads.
        </p>
      </Section>

      <Section title="Third parties">
        <List>
          <li>
            <strong className="text-paper">TMDB</strong> supplies all film metadata and poster
            images. Posters are served from our own servers rather than loaded from theirs, so
            TMDB never sees your browser or your IP address. Searches you type are sent to TMDB to
            look up films, <em>without</em> any identifier tying them to your account.
          </li>
          <li>
            <strong className="text-paper">Our email provider</strong> receives your address when
            we send a verification or password-reset link.
          </li>
          <li>
            <strong className="text-paper">Our hosting and database providers</strong> hold the
            data on our behalf.
          </li>
        </List>
      </Section>

      <Section title="Your data is yours">
        <p>
          <Link href="/settings" className="text-paper underline underline-offset-2">
            Settings
          </Link>{" "}
          has a one-click export of everything you&apos;ve logged, as JSON, plus CSVs shaped for
          Letterboxd&apos;s importer. It is free, has no gate on it, and always will. There is no
          paywall code in this project to switch on later.
        </p>
        <p className="mt-3">
          The same page deletes your account. Deletion is immediate and permanent: your diary,
          ratings, reviews, watchlist, comments, friendships, and photo are removed from the
          database, not flagged as hidden. Lists you own that other people are also on are handed
          over to another member rather than deleted out from under them. Take an export first if
          you want one, because we cannot recover anything afterwards.
        </p>
      </Section>

      <Section title="How long things are kept">
        <p>
          Until you delete them. Expired sessions and used email links are swept automatically.
          Deleting your account removes everything at once.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, or a request about your data:{" "}
          <a href={`mailto:${contact}`} className="text-paper underline underline-offset-2">
            {contact}
          </a>
          .
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
