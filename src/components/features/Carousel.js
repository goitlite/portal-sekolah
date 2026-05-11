"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Carousel() {
  const images = [
    "/images/banner1.jpg",
    "/images/banner2.jpg",
    "/images/banner3.jpg",
    "/images/banner4.jpg",
    "/images/banner5.jpg",
    "/images/banner6.jpg",
    "/images/banner7.jpg",
    "/images/banner8.jpg",
  ];

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-5xl mx-auto mt-6 px-4">
      <div className="relative w-full h-[250px] md:h-[400px] rounded-2xl overflow-hidden shadow-lg">
        <Image
          src={images[current]}
          alt="Banner"
          fill
          className="object-cover transition-all duration-700"
        />
      </div>
    </div>
  );
}
