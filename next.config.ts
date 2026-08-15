import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
