const REFERRAL_CODE = "ALBEDO_VIP_2026"; 
const BASE_URL = "https://dramabox.botraiki.biz/api";

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// CONFIG HEADERS
const getHeaders = (endpoint) => {
    // Detail error jika pakai header, tapi Episodes butuh header
    if (endpoint === '/detail') return {}; 
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://dramabox.com/',
        'Origin': 'https://dramabox.com/'
    };
};

const fetchData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { 
            params,
            headers: getHeaders(endpoint),
            timeout: 60000 // 60 Detik (PENTING SESUAI DOKUMENTASI)
        });
        return response.data;
    } catch (error) {
        console.error(`Error ${endpoint}:`, error.message);
        return null;
    }
};

// 1. HOME
app.get('/api/home', async (req, res) => {
    const [trending, forYou, dubbed, latest, vip] = await Promise.all([
        fetchData('/trending'),
        fetchData('/for-you'),
        fetchData('/dubbed', { classify: 'terpopuler', page: 1 }),
        fetchData('/latest', { page: 1 }),
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

// 2. LIST (PAGINATION)
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

// 3. EPISODES (FIXED PARSING & LIMIT)
app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    
    // Kita minta size sangat besar
    const result = await fetchData('/episodes', { 
        bookId, 
        page: 1, 
        size: 5000 
    });
    
    if (Array.isArray(result)) {
        const formatted = result.map(ep => {
            let videoUrl = "";
            
            // LOGIKA PARSING JSON USER:
            // Cek cdnList -> videoPathList
            if (ep.cdnList && ep.cdnList.length > 0) {
                const videoData = ep.cdnList[0]; // Ambil CDN pertama
                
                if (videoData.videoPathList && videoData.videoPathList.length > 0) {
                    const paths = videoData.videoPathList;
                    
                    // Prioritas:
                    // 1. Kualitas 720p (biasanya stabil)
                    // 2. Kualitas Default (isDefault == 1)
                    // 3. Paling pertama (fallback)
                    
                    const bestQuality = paths.find(p => p.quality === 720) || 
                                      paths.find(p => p.isDefault === 1) || 
                                      paths[0];
                                      
                    videoUrl = bestQuality ? bestQuality.videoPath : "";
                }
            }
            
            return {
                index: ep.chapterIndex,
                title: ep.chapterName, // "EP 1"
                videoUrl: videoUrl
            };
        });
        
        // Urutkan ascending (0, 1, 2...)
        formatted.sort((a, b) => a.index - b.index);
        
        return res.json(formatted);
    }
    
    // Jika result bukan array (mungkin error rate limit), return kosong
    res.json([]);
});

// 4. SEARCH & OTHERS
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
    // Handle wrap data.data
    res.json(result.data ? result.data : result);
});

module.exports = app;
