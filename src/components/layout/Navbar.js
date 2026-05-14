import Image from "next/image";

export default function Navbar() {
  return (
    <header
      className="
        fixed
        top-0
        left-0
        right-0
        z-[2000]

        h-[74px]

        bg-slate-950/65
        backdrop-blur-2xl

        border-b
        border-white/10

        shadow-[0_8px_30px_rgba(0,0,0,0.35)]
      "
    >
      {/* SOFT LIGHT EFFECT */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-10 w-60 h-60 bg-cyan-500/10 blur-3xl rounded-full"></div>

        <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/10 blur-3xl rounded-full"></div>
      </div>

      <div
        className="
          relative
          max-w-7xl
          mx-auto

          h-full

          px-4
          md:px-6

          flex
          items-center
          justify-between
        "
      >
        {/* LOGO + TITLE */}
        <div className="flex items-center gap-3 min-w-0">
          {/* LOGO */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full"></div>

            <Image
              src="/logo.png"
              alt="Logo"
              width={48}
              height={48}
              className="
                relative
                rounded-full
                border
                border-yellow-400/30
                shadow-[0_0_20px_rgba(255,215,0,0.25)]
              "
            />
          </div>

          {/* TITLE */}
          <div className="min-w-0">
            <h1
              className="
                text-sm
                sm:text-lg
                md:text-2xl

                font-black

                bg-gradient-to-r
                from-yellow-100
                via-yellow-300
                to-amber-500

                bg-clip-text
                text-transparent

                leading-tight
                truncate
              "
            >
              Portal TJKT SMKN 1 Teluk Kuantan
            </h1>

            <p
              className="
                text-[10px]
                md:text-xs

                font-semibold
                tracking-wide

                text-slate-300

                truncate
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

            px-4
            py-2

            rounded-2xl

            bg-white/5
            border
            border-white/10

            backdrop-blur-xl
          "
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>

          <span className="text-sm text-white font-medium">System Online</span>
        </div>
      </div>
    </header>
  );
}
