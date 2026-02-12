const BASE_URL = "https://dramabox.botraiki.biz/api";
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// CONFIG HEADERS (Agar dianggap browser asli)
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://dramabox.com/',
    'Origin': 'https://dramabox.com/'
};

const fetchData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { 
            params,
            headers: (endpoint.includes('detail')) ? {} : headers, // Detail error pakai header, Episode butuh header
            timeout: 59000 // Set mendekati batas Vercel (60s)
        });
        return response.data;
    } catch (error) {
        return null;
    }
};

// 1. EPISODES (CORE FIX)
app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    if (!bookId) return res.json([]);

    // Request dengan parameter size besar untuk memancing "All Episodes"
    const result = await fetchData('/episodes', { bookId, size: 5000, page: 1 });
    
    if (Array.isArray(result)) {
        const formatted = result.map(ep => {
            let videoUrl = "";
            
            // LOGIKA PARSING JSON TERBARU (Sesuai Log Kamu)
            // Struktur: cdnList -> videoPathList -> { quality: 720, videoPath: "..." }
            if (ep.cdnList && ep.cdnList.length > 0) {
                // Cari CDN yang aktif
                const cdn = ep.cdnList.find(c => c.videoPathList && c.videoPathList.length > 0) || ep.cdnList[0];
                
                if (cdn && cdn.videoPathList) {
                    // Prioritas Kualitas: 720p (Stabil) -> 1080p (Berat) -> 540p (Cepat) -> Default
                    const paths = cdn.videoPathList;
                    const bestVid = paths.find(v => v.quality === 720) || 
                                    paths.find(v => v.quality === 1080) || 
                                    paths.find(v => v.isDefault === 1) || 
                                    paths[0];
                                    
                    videoUrl = bestVid ? bestVid.videoPath : "";
                }
            }
            
            return {
                index: ep.chapterIndex,
                title: ep.chapterName || `Episode ${ep.chapterIndex + 1}`,
                videoUrl: videoUrl
            };
        });
        
        // Urutkan Episode 1 -> Terakhir
        formatted.sort((a, b) => a.index - b.index);
        return res.json(formatted);
    }
    
    res.json([]);
});

// 2. HOME & LIST
app.get('/api/home', async (req, res) => {
    const [trending, forYou, dubbed, latest, vip] = await Promise.all([
        fetchData('/trending'),
        fetchData('/for-you'),
        fetchData('/dubbed', { classify: 'terpopuler' }),
        fetchData('/latest'),
        fetchData('/vip')
    ]);

    let vipList = [];
    if (vip && vip.columnVoList) {
        vip.columnVoList.forEach(col => { if (col.bookList) vipList = [...vipList, ...col.bookList]; });
    }

    res.json({
        sections: [
            { title: "Sedang Trending 🔥", type: 'trending', data: trending || [] },
            { title: "Rekomendasi Untukmu ❤️", type: 'for-you', data: forYou || [] },
            { title: "Eksklusif VIP 👑", type: 'vip', data: vipList.slice(0, 8) },
            { title: "Dubbing Indonesia 🇮🇩", type: 'dubbed', data: dubbed || [] },
            { title: "Rilis Terbaru 🆕", type: 'latest', data: latest || [] }
        ]
    });
});

app.get('/api/list', async (req, res) => {
    const { type, page = 1 } = req.query;
    let endpoint = '/latest';
    let params = { page };

    if (type === 'trending') endpoint = '/trending';
    else if (type === 'for-you') endpoint = '/for-you';
    else if (type === 'dubbed') { endpoint = '/dubbed'; params.classify = 'terpopuler'; }
    else if (type === 'vip') endpoint = '/vip';

    const data = await fetchData(endpoint, params);
    
    if (type === 'vip') {
        let vipList = [];
        if (data && data.columnVoList) {
            data.columnVoList.forEach(col => { if (col.bookList) vipList = [...vipList, ...col.bookList]; });
        }
        return res.json(vipList);
    }
    const result = (Array.isArray(data)) ? data : (data?.records || []);
    res.json(result);
});

// 3. OTHERS
app.get('/api/search', async (req, res) => {
    const { query } = req.query;
    const result = await fetchData('/search', { query });
    res.json(result || []);
});
app.get('/api/search/popular', async (req, res) => {
    const result = await fetchData('/popular-searches');
    res.json(result || []);
});
app.get('/api/random', async (req, res) => {
    const result = await fetchData('/random');
    res.json(result || []);
});
app.get('/api/detail', async (req, res) => {
    const { bookId } = req.query;
    const result = await fetchData('/detail', { bookId });
    res.json(result.data ? result.data : (result || {}));
});

module.exports = app;
