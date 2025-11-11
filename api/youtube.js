// Vercel Serverless Function (Node.js)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Vercel 환경 변수(보안 금고)에서 API 키를 가져옵니다. (process.env)
    const GCP_API_KEY = process.env.GCP_API_KEY;

    // 2. 브라우저(Frontend)가 보낸 요청 값을 받습니다.
    const { keyword, publishedAfter, maxResults } = req.body;

    // 3. (중요) API Quota Hell을 피하기 위해 필터링을 '단순화'합니다.
    // 구독자 수, 조회수 필터는 API 호출을 수십 배로 늘리므로 '금지'합니다.
    // 검색(search.list) -> 상세(videos.list) 2단계 호출로 최적화합니다.
    
    try {
        // 3.1. search.list (영상 ID 수집)
        let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&regionCode=KR&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}&key=${GCP_API_KEY}&videoDuration=long`; // 롱폼 우선
        if (publishedAfter) {
            searchUrl += `&publishedAfter=${publishedAfter}`;
        }

        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error('YouTube Search API 실패');
        const searchData = await searchRes.json();
        
        if (!searchData.items || searchData.items.length === 0) {
            return res.status(200).json([]);
        }

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');

        // 3.2. videos.list (조회수 등 상세 정보 수집)
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${GCP_API_KEY}`;
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error('YouTube Videos API 실패');
        const videoData = await videoRes.json();

        // 4. 브라우저가 원하는 '깨끗한' 데이터만 가공하여 전달합니다.
        const videos = videoData.items.map(item => ({
            videoId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            viewCount: item.statistics.viewCount,
            likeCount: item.statistics.likeCount,
            videoUrl: `https://www.youtube.com/watch?v=${item.id}`
        }));

        res.status(200).json(videos);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
