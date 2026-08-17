import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas는 네이티브 .node 바이너리를 로드하는 패키지라 Turbopack이
  // ESM 청크로 번들링하지 못한다 — 런타임에 Node의 require로 그대로 불러오도록
  // 서버 번들링에서 제외한다.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // pdfjs-dist는 실행 시점에 pdf.worker.mjs를 동적으로 import해서 "가짜
  // 워커"(별도 스레드 없이 같은 프로세스에서 도는)를 띄우는데, 이 동적
  // import는 정적 분석으로 잡히지 않아 Vercel의 파일 트레이싱이 워커 파일과
  // 표준 폰트를 서버리스 번들에서 빠뜨렸다 — 배포본에서 "Cannot find module
  // .../pdf.worker.mjs" 에러로 페이지 이미지 렌더링이 조용히 실패했다.
  // 명시적으로 포함시켜서 번들에 함께 들어가도록 한다.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
  },
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
