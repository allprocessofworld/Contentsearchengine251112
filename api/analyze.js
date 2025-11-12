// Vercel Serverless Function (Node.js)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. 환경 변수에서 Gemini 키 로드
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY가 Vercel 환경 변수에 설정되지 않았습니다." });
    }
    
    // *** 1. (BUG FIX 3) 404 오류가 계속되므로, 1.5 모델이 아닌
    // 'Generative Language API'의 가장 기본 모델인 'gemini-pro'로 롤백합니다.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    // 2. 브라우저에서 보낸 텍스트 받기
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: "분석할 텍스트가 없습니다." });
    }

    // 2. (기능 변경) Gemini API에 보낼 프롬프트 수정
    const payload = {
        contents: [{
            parts: [{
                text: `당신은 대한민국 산업 다큐멘터리 PD입니다. 다음 영상 정보를 보고, 이 영상의 [핵심 주제 및 소재] 1가지를 추출해주세요. (예: "초대형 선박 건조", "반도체 웨이퍼 공정", "수제 초콜릿 공장"). 응답은 반드시 다음 JSON 형식으로만 하십시오: {"topic_material": "추출한 주제"}. 만약 분석이 불가능하면 {"topic_material": "분석 실패"} 라고 응답하십시오.\n\n[입력 텍스트]\n${text}`
            }]
        }]
    };

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // API 키가 잘못되었거나 GCP 프로젝트 설정이 잘못된 경우
            const errorBody = await response.json();
            console.error("Gemini API 호출 실패:", errorBody);
            throw new Error(`Gemini API 호출 실패 (${response.status}): ${errorBody.error?.message || '알 수 없는 오류'}`);
        }

        const result = await response.json();

        // 7. (오류 수정) Gemini가 응답을 거부했는지 (예: 안전 설정) 확인
        if (!result.candidates || !result.candidates[0].content || !result.candidates[0].content.parts) {
            console.error("Gemini API 응답 없음:", result);
            throw new Error('Gemini API가 유효한 응답을 반환하지 않았습니다. (안전 등급 문제일 수 있음)');
        }
        
        const rawText = result.candidates[0].content.parts[0].text;
        let parsedData;

        // 7. (오류 수정) AI가 JSON이 아닌 텍스트를 반환할 경우를 대비한 강력한 파싱
        try {
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanText);
        } catch (parseError) {
            // 파싱 실패 시, AI가 보낸 원본 텍스트를 로그에 남김
            console.error("Gemini 응답 JSON 파싱 실패. 원본 텍스트:", rawText);
            throw new Error('AI가 JSON 형식이 아닌 응답을 반환했습니다.');
        }
        
        // 2. (기능 변경) 새로운 JSON 형식({topic_material: "..."})으로 응답
        res.status(200).json(parsedData);

    } catch (error) {
        console.error("api/analyze.js 내부 오류:", error.message);
        res.status(500).json({ error: error.message });
    }
}
