import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-root">
      <Link className="home-link" href="/preview">
        Open ASCII Rhythm Preview
      </Link>
    </main>
  );
}
