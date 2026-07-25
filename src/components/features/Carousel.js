"use client";

import Image from "next/image";

export default function Carousel() {
  const images = ["/images/Banner25.jpg"];

  return (
    // Coba gunakan mt-16 (sekitar 64px). Jika masih terlalu bawah, ganti jadi mt-12 (48px)
    <div className="max-w-5xl mx-auto mt-7 px-4">
      <div className="relative w-full h-[250px] md:h-[400px] rounded-2xl overflow-hidden shadow-lg z-0">
        <Image
          src={images[0]}
          alt="Banner"
          fill
          priority
          className="object-cover"
        />
      </div>
    </div>
  );
}
