// Vercel Serverless Function (Node.js)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. 환경 변수에서 키 로드
    const GCP_API_KEY = process.env.GCP_API_KEY;
    const CSE_ID = process.env.CSE_ID;

    // 2. 브라우저에서 보낸 검색어 받기
    const { query } = req.body;

    // 3. (경고) 다시 말하지만, 이메일/전화번호 자동 스크래핑은 '불가'합니다.
    // 우리는 '기업명'과 '홈페이지'만 검색합니다.
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GCP_API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=5`; // 5개만

    try {
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error('Google Custom Search API 실패');
        
        const result = await response.json();
        
        let companies = [];
        if (result.items && result.items.length > 0) {
            companies = result.items.map(item => ({
                title: item.title,
                link: item.link
            }));
        }

        res.status(200).json({ companies });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
