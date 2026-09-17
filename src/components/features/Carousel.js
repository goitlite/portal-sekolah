"use client";

import Image from "next/image";

export default function Carousel() {
  const images = ["/images/banner7.jpg"];

  return (
    <div className="max-w-5xl mx-auto mt-[70px] px-4">
      {/* Mengganti h-[250px] menjadi aspect-[16/9] atau aspect-[2/1] */}
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg z-0">
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
