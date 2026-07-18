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

bg-gradient-to-r
from-blue-900
via-blue-800
to-indigo-900

text-white

border-b
border-blue-700/50

shadow-lg

transition-all
"
    >
      {/* SOFT LIGHT EFFECT (Disesuaikan untuk Light Mode) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-0 w-72 h-72 bg-cyan-300/20 blur-3xl rounded-full"></div>

        <div className="absolute top-0 right-0 w-60 h-60 bg-blue-500/20 blur-3xl rounded-full"></div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-40 bg-sky-300/10 blur-3xl rounded-full"></div>
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
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* LOGO */}
          <div className="relative shrink-0 group">
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative bg-white/95 p-1 sm:p-1.5 rounded-[1rem] border border-white/30 shadow-sm flex items-center justify-center transition-transform group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="Logo"
                width={42}
                height={42}
                className="object-contain w-[36px] h-[36px] sm:w-[42px] sm:h-[42px]"
              />
            </div>
          </div>

          {/* TITLE */}
          <div className="min-w-0 flex flex-col justify-center">
            <h1
              className="
text-sm
sm:text-lg
md:text-xl

font-black
tracking-tight

text-white

leading-tight
truncate
drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]
"
            >
              Portal TJKT SMKN 1 Teluk Kuantan
            </h1>

            <p
              className="
                text-[9px]
                md:text-[11px]

                font-bold
                uppercase
                tracking-widest

                text-slate-100
                mt-0.5

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
            gap-2.5

            px-4
            py-2

            rounded-full

            bg-emerald-50
            border
            border-emerald-100

            shadow-sm
            transition-all
            hover:shadow-md
            hover:bg-emerald-100
          "
        >
          {/* Dot Indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>

          <span className="text-[11px] text-emerald-700 font-extrabold tracking-widest uppercase mt-0.5">
            System Online
          </span>
        </div>
      </div>
    </header>
  );
}
