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
  part: string;
  part_order: number;
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
문제마다 (1) 파트 (2) 문제번호 (3) 단원 (4) 세부 유형 (5) 난이도를 배열로 반환해줘.
- 핵심 규칙: 문제 번호가 도중에 다시 1번으로 리셋되는 지점마다 "새로운 파트"가
  시작된 것으로 간주해. 같은 문제집 안에서 서로 다른 두 문제가 part 값과
  problem_number 값을 동시에 똑같이 가지면 절대 안 돼 — 이게 가장 중요한 제약이야.
- "일품" 같은 문제집은 단원(챕터)마다 "개념&핵심기출" → "고난도 문제" →
  "최고수준 문제" 섹션이 반복되고, 섹션이 바뀔 때마다 번호가 1로 리셋돼. 이런
  경우 단원 제목과 섹션 제목을 합쳐서 고유한 값을 만들어줘. 예를 들어 1단원
  "유리수와 순환소수"의 개념&핵심기출과 2단원 "정수와 유리수"의 개념&핵심기출은
  둘 다 1번부터 시작하더라도 서로 다른 단원이므로, part를 "유리수와 순환소수 -
  개념&핵심기출", "정수와 유리수 - 개념&핵심기출"처럼 단원명까지 포함해서
  각각 다르게 적어줘. 섹션 제목 없이 단원마다 번호만 리셋되는 문제집이면 단원
  제목만 part로 써도 돼.
- 문제집 전체를 통틀어 번호가 한 번도 리셋되지 않고 하나로 쭉 이어진다면 모든
  문제의 part를 빈 문자열("")로 둬.
- problem_number는 문제집에 표기된 번호를 정수로 변환해서 넣어줘 (예: "12번" → 12).
  파트가 있는 문제집이면 그 파트 안에서의 번호를 그대로 쓰면 돼(파트마다 1번부터
  시작해도 됨) — 전체를 통틀어 다시 매길 필요 없어.
- 지문/해설/광고 페이지 등 실제 문제가 아닌 부분은 건너뛰고, 문제만 빠짐없이 순서대로 포함해줘.
${listSection}
${DIFFICULTY_GUIDE}`;
}

function isServiceUnavailable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 503) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("503") || message.includes("UNAVAILABLE");
}

// 문제집 PDF 분석에 쓸 모델을 좋은 순서대로 나열한 것. 앞에서부터 시도하고
// 과부하(503)면 다음 모델로 넘어간다.
//
// 폴백을 하나만 두지 않는 이유: 2026-09-24 실측 결과 3.6/3.7/3.8-flash가
// "동시에" 503을 냈고, 3.5 계열만 살아 있었다. 어느 모델이 막힐지는 그때그때
// 달라서(같은 날 몇 분 사이에 3.6이 됐다 안 됐다 했다), 특정 모델 하나를
// 폴백으로 찍어두면 그 모델까지 같이 막혔을 때 그대로 실패한다. 끝의 lite는
// 분류 품질이 조금 떨어져도 응답은 받기 위한 최후의 보루다.
const WORKBOOK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

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
          part: { type: Type.STRING },
          problem_number: { type: Type.INTEGER },
          category: { type: Type.STRING, enum: options.map((o) => o.key) },
          difficulty: { type: Type.STRING, enum: ["하", "중", "상", "최상"] },
        },
        required: ["part", "problem_number", "category", "difficulty"],
      }
    : {
        type: Type.OBJECT,
        properties: {
          part: { type: Type.STRING },
          problem_number: { type: Type.INTEGER },
          unit: { type: Type.STRING },
          problem_type: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["하", "중", "상", "최상"] },
        },
        required: ["part", "problem_number", "unit", "problem_type", "difficulty"],
      };

  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: fileBuffer.toString("base64") } },
        { text: prompt },
      ],
    },
  ];
  const config = {
    responseMimeType: "application/json",
    responseSchema: { type: Type.ARRAY, items: itemSchema },
  };

  // 각 모델은 attempts: 1로 한 번만 때린다. SDK 기본 재시도(5xx에 최대 5회
  // 지수 백오프)를 그대로 두면 이미 막힌 모델 하나를 붙잡고 수십 초를 버리는데,
  // PDF 분석 자체가 60초 이상 걸리는 작업이라 그러다 maxDuration(180초)을 넘겨
  // 함수가 통째로 끊긴다. 503은 즉시 돌아오므로 다음 모델로 빨리 넘어가는 편이
  // 전체 성공률이 훨씬 높다.
  let response;
  let lastError: unknown;
  for (const model of WORKBOOK_MODELS) {
    try {
      response = await ai.models.generateContent({
        model,
        contents,
        config: { ...config, httpOptions: { retryOptions: { attempts: 1 } } },
      });
      break;
    } catch (error) {
      // 503(과부하)이 아니라면 다른 모델로 바꿔도 결과가 같을 문제(잘못된 PDF,
      // API 키, 스키마 등)이므로 그대로 올려보낸다.
      if (!isServiceUnavailable(error)) throw error;
      lastError = error;
    }
  }
  if (!response) {
    console.error("parseWorkbookPdf: all models unavailable", lastError);
    throw new Error("503 모든 분석 모델이 과부하 상태입니다.");
  }

  const rawResponse = response.text ?? "";
  if (rawResponse.trim() === "") {
    throw new Error("AI가 빈 응답을 반환했습니다.");
  }
  const parsed = JSON.parse(rawResponse) as Array<Record<string, unknown>>;

  const partOrder = new Map<string, number>();
  function orderOfPart(part: string): number {
    if (!partOrder.has(part)) partOrder.set(part, partOrder.size);
    return partOrder.get(part)!;
  }

  const problems: ParsedWorkbookProblem[] = parsed
    .map((item) => {
      const problemNumber = Number(item.problem_number);
      if (!Number.isFinite(problemNumber)) return null;
      const part = typeof item.part === "string" ? item.part.trim() : "";
      const difficulty = item.difficulty as ParsedWorkbookProblem["difficulty"];

      if (useConstrainedList) {
        const matched = optionsByKey.get(item.category as string);
        if (!matched) return null;
        return {
          part,
          part_order: orderOfPart(part),
          problem_number: problemNumber,
          unit: matched.unit,
          problem_type: matched.problem_type,
          difficulty,
        };
      }
      return {
        part,
        part_order: orderOfPart(part),
        problem_number: problemNumber,
        unit: item.unit as string,
        problem_type: item.problem_type as string,
        difficulty,
      };
    })
    // PDF에 등장한 순서를 그대로 유지한다 — 파트가 있는 문제집은 번호가
    // 파트마다 리셋되므로, 전체를 problem_number 기준으로 재정렬하면
    // 파트가 뒤섞인다. 파트/번호는 문제집에 표기된 값을 그대로 신뢰하고,
    // 저장 시 (workbook_id, part, problem_number) 단위로 유니크하게 관리한다.
    .filter((p): p is ParsedWorkbookProblem => p !== null);

  return { problems, rawResponse };
}

export interface WeaknessReportEntry {
  unit: string;
  problemType: string;
  difficulty: string;
  reason: string | null;
  recordedAt: string;
}

// 문제 분류(gemini-3.6-flash)와 달리, 여러 건의 오답 이유 텍스트에서 공통
// 패턴을 읽어내고 글로 정리하는 작업이라 추론력이 더 좋은 모델을 쓴다.
const REPORT_MODEL = "gemini-3.7-flash";
// REPORT_MODEL이 일시적으로 과부하(503)일 때만 재시도하는 폴백. 문제
// 분류용 모델과 같은 걸 재사용한다 — 리포트 품질은 조금 낮아지지만 항상
// 응답은 받을 수 있다.
const REPORT_FALLBACK_MODEL = "gemini-3.6-flash";

export async function generateWeaknessReport(
  studentName: string,
  entries: WeaknessReportEntry[]
): Promise<string> {
  const hasAnyReason = entries.some((e) => e.reason && e.reason.trim() !== "");

  const listText = entries
    .map((e) => {
      const reasonText = e.reason && e.reason.trim() !== "" ? e.reason.trim() : "(이유 미입력)";
      const date = new Date(e.recordedAt).toLocaleDateString("ko-KR");
      return `- ${e.unit} · ${e.problemType} · 난이도 ${e.difficulty} · ${reasonText} · ${date}`;
    })
    .join("\n");

  const prompt = `너는 수학 학원 강사를 도와 학생의 오답 기록을 분석하는 조교야.
아래는 학생 "${studentName}"의 오답 기록 목록이야 (단원 · 세부유형 · 난이도 · 학생이 적은 틀린 이유 · 기록일):

${listText}

이 기록을 바탕으로 다음 세 부분으로 구성된 한국어 리포트를 작성해줘:

1. **취약 유형**: 오답 빈도가 높은 단원/세부유형을 상위 3~5개 정도 꼽고, 각각 몇 건인지 근거를 함께 제시해줘.
2. **원인 패턴**: 학생이 적은 "틀린 이유" 텍스트들을 읽고, 반복되는 원인(예: 특정 개념 이해 부족, 계산 실수, 문제 해석 오류, 시간 부족 등)을 직접 찾아서 정리해줘. 카테고리는 미리 정해진 게 없으니 실제 텍스트 내용에 근거해서 자유롭게 이름 붙여도 돼.
3. **보완 방법 제안**: 위 취약 유형과 원인 패턴에 맞춰, 이 학생에게 구체적으로 어떤 것을 보완하면 좋을지 실행 가능한 제안을 해줘.

${hasAnyReason ? "" : "주의: 이 학생은 틀린 이유를 하나도 입력하지 않았어. 2번 항목에서는 원인 패턴을 추측하지 말고, 이유가 기록되지 않아 원인 분석이 제한적이라는 점을 명시해줘."}

과장하지 말고 담백하게, 강사가 바로 읽고 활용할 수 있는 톤으로 써줘.`;

  const contents = [{ role: "user", parts: [{ text: prompt }] }];

  try {
    // SDK 기본값은 5xx에 대해 지수 백오프로 최대 5회, 수십 초까지 재시도한다.
    // REPORT_MODEL이 과부하(503)일 때는 같은 모델을 붙잡고 기다리는 대신
    // 바로 실패시켜서 아래 폴백 모델로 넘어가게 한다.
    const response = await ai.models.generateContent({
      model: REPORT_MODEL,
      contents,
      config: { httpOptions: { retryOptions: { attempts: 1 } } },
    });
    return response.text ?? "";
  } catch (error) {
    if (!isServiceUnavailable(error)) throw error;
    const response = await ai.models.generateContent({
      model: REPORT_FALLBACK_MODEL,
      contents,
    });
    return response.text ?? "";
  }
}
