import Image from 'next/image';

export function SplashScreen() {
  return (
    <div className="splash-screen" aria-hidden="true">
      <Image
        className="splash-logo"
        src="/logo.png"
        width={750}
        height={1600}
        alt=""
        preload
      />
    </div>
  );
}
