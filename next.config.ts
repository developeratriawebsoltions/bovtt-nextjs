import type { NextConfig } from "next";

const allowedDevOrigins = Array.from(
  new Set(
    [
      "http://localhost:3000",
      "http://localhost:8090",
      "https://localhost:8090",
      "https://bovtt.atriatestingsite.com",
      process.env.ALLOWED_DEV_ORIGINS,
      process.env.NEXT_PUBLIC_APP_URL,
    ]
      .filter(Boolean)
      .flatMap((value) =>
        String(value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
  )
);

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? {} : { allowedDevOrigins }),
};

export default nextConfig;