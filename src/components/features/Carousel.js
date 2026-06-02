"use client";

import Image from "next/image";

export default function Carousel() {
  const images = ["/images/banner1.jpg"];

  return (
    <div className="max-w-5xl mx-auto mt-6 px-4">
      {" "}
      <div className="relative w-full h-[250px] md:h-[400px] rounded-2xl overflow-hidden shadow-lg">
        {" "}
        <Image
          src={images[0]}
          alt="Banner"
          fill
          priority
          className="object-cover"
        />{" "}
      </div>{" "}
    </div>
  );
}
