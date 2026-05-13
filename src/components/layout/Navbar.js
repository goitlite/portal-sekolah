import Image from "next/image";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        {/* LOGO + TITLE */}
        <div className="flex items-center gap-4">
          {/* LOGO */}
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400/30 blur-xl rounded-full"></div>

            <Image
              src="/logo.png"
              alt="Logo"
              width={56}
              height={56}
              className="
                relative
                rounded-full
                border-2
                border-yellow-400/40
                shadow-[0_0_25px_rgba(255,215,0,0.35)]
              "
            />
          </div>

          {/* TITLE */}
          <div>
            <h1
              className="
                text-2xl
                md:text-3xl
                font-black
                bg-gradient-to-r
                from-yellow-100
                via-yellow-300
                to-amber-500
                bg-clip-text
                text-transparent
                drop-shadow-[0_0_20px_rgba(255,215,0,0.35)]
              "
            >
              Portal TJKT SMKN 1 Teluk Kuantan
            </h1>

            <p
              className="
                text-xs
                md:text-sm
                font-semibold
                tracking-wide
                bg-gradient-to-r
                from-yellow-100
                via-yellow-300
                to-amber-400
                bg-clip-text
                text-transparent
              "
            >
              Sistem Digital Sekolah
            </p>
          </div>
        </div>

        {/* STATUS */}
        <div
          className="
            hidden
            md:flex
            items-center
            gap-2
            bg-white/10
            border
            border-white/10
            backdrop-blur-xl
            px-4
            py-2
            rounded-2xl
          "
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>

          <span className="text-sm text-white font-medium">Online</span>
        </div>
      </div>
    </header>
  );
}
