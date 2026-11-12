import Image from 'next/image';

export function MaintenanceScreen() {
  return (
    <main className="maintenance-screen">
      <section className="maintenance-card" aria-labelledby="maintenance-title">
        <Image
          className="maintenance-illustration"
          src="/maintenance-illustration.png"
          alt="Maintenance tools and dashboard illustration"
          width={1024}
          height={1024}
          priority
        />
        <p className="maintenance-eyebrow">SSF Mukkam Finance</p>
        <h1 id="maintenance-title">Under maintenance</h1>
        <p>We’re making a few improvements. Please check back soon.</p>
      </section>
    </main>
  );
}
