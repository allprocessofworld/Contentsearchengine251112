// Vercel Serverless Function (Node.js)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. 환경 변수에서 Gemini 키 로드
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    // 2. 브라우저에서 보낸 텍스트 받기
    const { text } = req.body;

    // 3. Gemini API에 보낼 프롬프트 (JSON 형식 강제)
    const payload = {
        contents: [{
            parts: [{
                text: `당신은 대한민국 산업 다큐멘터리 PD입니다. 다음 영상 정보를 보고, [핵심 주제] 3가지와 [구체적인 산업/업종] 3가지를 추출해주세요. 응답은 반드시 다음 JSON 형식으로만 하십시오: {"topics": ["주제1", "주제2"], "industries": ["산업1", "산업2"]}\n\n[입력 텍스트]\n${text}`
            }]
        }]
    };

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Gemini API 호출 실패');

        const result = await response.json();
        const rawText = result.candidates[0].content.parts[0].text;
        
        // 4. Gemini가 보낸 텍스트(JSON 모양)를 실제 JSON으로 파싱
        const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanText);

        res.status(200).json(parsedData); // { topics: [...], industries: [...] }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
