const REFERRAL_CODE = "ALBEDO_VIP_2026"; 
const BASE_URL = "https://dramabox.botraiki.biz/api";

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- FETCHING DENGAN HEADER PALSU (ANTI-BLOKIR) ---
const fetchData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { 
            params,
            headers: {
                // Header ini wajib agar video tidak error 403/Forbidden
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dramabox.com/',
                'Origin': 'https://dramabox.com/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000 // Naikkan timeout ke 30 detik buat jaga-jaga
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

// 2. LIST
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

// 3. EPISODES (CRITICAL FIX)
app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    // Menggunakan fetchData yang sudah ada header-nya
    const result = await fetchData('/episodes', { bookId });
    
    if (Array.isArray(result)) {
        const formatted = result.map(ep => {
            let videoUrl = "";
            if (ep.cdnList && ep.cdnList.length > 0) {
                const paths = ep.cdnList[0].videoPathList;
                // Cari kualitas 720p atau default, kalau ga ada ambil index 0
                const vid = paths.find(p => p.quality === 720) || paths.find(p => p.isDefault === 1) || paths[0];
                videoUrl = vid ? vid.videoPath : "";
            }
            return {
                index: ep.chapterIndex,
                title: ep.chapterName,
                videoUrl: videoUrl
            };
        });
        return res.json(formatted);
    }
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

module.exports = app;
