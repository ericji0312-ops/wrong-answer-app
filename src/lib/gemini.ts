import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { ClassificationResult, UnitTag } from "@/types/domain";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
}

const ai = new GoogleGenAI({ apiKey });

const BASE_PROMPT = `이 수학 문제 사진을 보고 (1) 큰 단원명 (2) 세부 문제 유형을 분류해줘.
- 단원명은 교과서 대단원 수준(예: 이차함수, 수열의 극한)으로 간결하게.
- 세부 유형은 실제로 이 문제가 다루는 구체적인 스킬/개념(예: 이차함수의 최댓값·최솟값 활용)으로 작성해줘.
- 문제 사진이 아니거나 내용을 알아볼 수 없으면 unit과 problem_type을 "분류 불가"로 답해줘.`;

function buildPrompt(allowedTags: UnitTag[]): string {
  if (allowedTags.length === 0) return BASE_PROMPT;

  const grouped = new Map<string, string[]>();
  for (const tag of allowedTags) {
    const list = grouped.get(tag.unit) ?? [];
    list.push(tag.problem_type);
    grouped.set(tag.unit, list);
  }
  const listText = [...grouped.entries()]
    .map(([unit, types]) => `- ${unit}: ${types.join(", ")}`)
    .join("\n");

  return `${BASE_PROMPT}

아래는 이 학원 커리큘럼에서 미리 정리해둔 단원/세부유형 목록이야. 문제가 이 목록에
있는 항목과 맞으면 그 표기 그대로 사용해줘. 목록에 맞는 게 정말 없을 때만 새로운
단원/유형 이름을 직접 만들어서 답해줘.

${listText}`;
}

export async function classifyWrongAnswer(
  fileBuffer: Buffer,
  mimeType: string,
  allowedTags: UnitTag[] = []
): Promise<{ result: ClassificationResult; rawResponse: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: fileBuffer.toString("base64") } },
          { text: buildPrompt(allowedTags) },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          unit: { type: Type.STRING },
          problem_type: { type: Type.STRING },
        },
        required: ["unit", "problem_type"],
      },
    },
  });

  const rawResponse = response.text ?? "";
  const parsed = JSON.parse(rawResponse) as ClassificationResult;

  return { result: parsed, rawResponse };
}
