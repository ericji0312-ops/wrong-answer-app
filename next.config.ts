import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas는 네이티브 .node 바이너리를 로드하는 패키지라 Turbopack이
  // ESM 청크로 번들링하지 못한다 — 런타임에 Node의 require로 그대로 불러오도록
  // 서버 번들링에서 제외한다.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  experimental: {
    serverActions: {
      // 문제집 PDF는 사진 여러 장 분량이라 기본 1MB 제한을 넘기기 쉬움.
      bodySizeLimit: "50mb",
    },
    // src/proxy.ts(미들웨어)를 거치는 요청은 서버 액션 제한과 별개로 기본
    // 10MB까지만 본문을 통과시키므로 이것도 같이 늘려줘야 PDF 업로드가 통과한다.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
