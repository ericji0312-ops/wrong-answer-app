import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { UnitTag } from "@/types/domain";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
}

const ai = new GoogleGenAI({ apiKey });

const DIFFICULTY_GUIDE = `- 난이도는 모의고사 체감 난이도 기준으로 "하"/"중"/"상"/"최상" 중 하나로 판단해줘.
  - 하: 모의고사 3점 문제보다 쉬운, 공식/개념 한 단계만 적용하면 풀리는 기본 문제.
  - 중: 모의고사 3점 문제 정도 난이도. 두세 단계를 조합하거나 계산이 다소 복잡한 문제.
  - 상: 모의고사에서 그럭저럭 어려운 편에 속하는 문제. 여러 개념을 함께 응용하거나 계산·논리 전개가 긴 문제.
  - 최상: 모의고사 최고난이도(킬러) 문제 수준. 여러 개념을 복합적으로 엮고 풀이 아이디어를 떠올리기 어려운 문제.`;

interface CategoryOption {
  key: string;
  unit: string;
  problem_type: string;
}

function buildCategoryOptions(allowedTags: UnitTag[]): CategoryOption[] {
  return allowedTags.map((t) => ({
    key: `${t.unit} · ${t.problem_type}`,
    unit: t.unit,
    problem_type: t.problem_type,
  }));
}

export interface ParsedWorkbookProblem {
  problem_number: number;
  unit: string;
  problem_type: string;
  difficulty: "하" | "중" | "상" | "최상";
}

function buildWorkbookPrompt(options: CategoryOption[]): string {
  const listText = options.map((o) => `- ${o.key}`).join("\n");
  const listSection =
    options.length > 0
      ? `아래 "등록된 단원·세부유형 목록" 중 각 문제와 가장 잘 맞는 항목 하나를 정확히
그 표기 그대로 골라서 unit/problem_type에 답해줘. 이 학원 커리큘럼에 이미 등록된
조합이므로, 목록에 없는 새로운 단원/유형 이름을 절대 만들어내지 마. 완전히
똑같지 않아도 반드시 목록 중 가장 가까운 항목 하나를 선택해.

등록된 단원·세부유형 목록:
${listText}`
      : `단원명은 교과서 대단원 수준(예: 이차함수, 수열의 극한)으로, 세부 유형은
실제로 그 문제가 다루는 구체적인 스킬/개념으로 작성해줘.`;

  return `이 문제집 PDF 안에 있는 모든 문제를 처음부터 끝까지 순서대로 찾아서,
문제마다 (1) 문제번호 (2) 단원 (3) 세부 유형 (4) 난이도를 배열로 반환해줘.
- problem_number는 문제집에 표기된 번호를 정수로 변환해서 넣어줘 (예: "12번" → 12).
- 지문/해설/광고 페이지 등 실제 문제가 아닌 부분은 건너뛰고, 문제만 빠짐없이 순서대로 포함해줘.
${listSection}
${DIFFICULTY_GUIDE}`;
}

export async function parseWorkbookPdf(
  fileBuffer: Buffer,
  allowedTags: UnitTag[] = []
): Promise<{ problems: ParsedWorkbookProblem[]; rawResponse: string }> {
  const options = buildCategoryOptions(allowedTags);
  const optionsByKey = new Map(options.map((o) => [o.key, o]));
  const useConstrainedList = options.length > 0;

  const prompt = buildWorkbookPrompt(options);

  const itemSchema = useConstrainedList
    ? {
        type: Type.OBJECT,
        properties: {
          problem_number: { type: Type.INTEGER },
          category: { type: Type.STRING, enum: options.map((o) => o.key) },
          difficulty: { type: Type.STRING, enum: ["하", "중", "상", "최상"] },
        },
        required: ["problem_number", "category", "difficulty"],
      }
    : {
        type: Type.OBJECT,
        properties: {
          problem_number: { type: Type.INTEGER },
          unit: { type: Type.STRING },
          problem_type: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["하", "중", "상", "최상"] },
        },
        required: ["problem_number", "unit", "problem_type", "difficulty"],
      };

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: fileBuffer.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: itemSchema },
    },
  });

  const rawResponse = response.text ?? "";
  const parsed = JSON.parse(rawResponse) as Array<Record<string, unknown>>;

  const problems: ParsedWorkbookProblem[] = parsed
    .map((item) => {
      const problemNumber = Number(item.problem_number);
      if (!Number.isFinite(problemNumber)) return null;
      const difficulty = item.difficulty as ParsedWorkbookProblem["difficulty"];

      if (useConstrainedList) {
        const matched = optionsByKey.get(item.category as string);
        if (!matched) return null;
        return {
          problem_number: problemNumber,
          unit: matched.unit,
          problem_type: matched.problem_type,
          difficulty,
        };
      }
      return {
        problem_number: problemNumber,
        unit: item.unit as string,
        problem_type: item.problem_type as string,
        difficulty,
      };
    })
    .filter((p): p is ParsedWorkbookProblem => p !== null)
    .sort((a, b) => a.problem_number - b.problem_number);

  return { problems, rawResponse };
}
