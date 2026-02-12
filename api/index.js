// ==========================================
// BACKEND VERCEL - ALBEDO TV (FINAL)
// ==========================================
const REFERRAL_CODE = "ALBEDO_VIP_2026"; 
const BASE_URL = "https://dramabox.botraiki.biz/api";
// ==========================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- Helper Fetch ---
const fetchData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
        return []; 
    }
};

// --- 1. HOME DASHBOARD (Parallel Fetching) ---
app.get('/api/home', async (req, res) => {
    const [trending, forYou, dubbed, latest, vip] = await Promise.all([
        fetchData('/trending'),
        fetchData('/for-you'),
        fetchData('/dubbed', { classify: 'terpopuler', page: 1 }),
        fetchData('/latest', { page: 1 }),
        fetchData('/vip')
    ]);

    // Parsing struktur VIP yang unik
    let vipList = [];
    if (vip && vip.columnVoList) {
        vip.columnVoList.forEach(col => { 
            if (col.bookList) vipList = [...vipList, ...col.bookList]; 
        });
    }

    res.json({
        referral: REFERRAL_CODE,
        sections: [
            { id: 'trending', title: "Sedang Trending 🔥", type: 'trending', data: trending ? trending.slice(0, 6) : [] },
            { id: 'foryou', title: "Rekomendasi Untukmu ❤️", type: 'for-you', data: forYou ? forYou.slice(0, 6) : [] },
            { id: 'vip', title: "Eksklusif VIP 👑", type: 'vip', data: vipList.slice(0, 6) },
            { id: 'dubbed', title: "Dubbing Indonesia 🇮🇩", type: 'dubbed', data: dubbed ? dubbed.slice(0, 6) : [] },
            { id: 'latest', title: "Rilis Terbaru 🆕", type: 'latest', data: latest ? latest.slice(0, 6) : [] }
        ]
    });
});

// --- 2. LIST PER KATEGORI (Pagination Support) ---
app.get('/api/list', async (req, res) => {
    const { type, page = 1 } = req.query;
    let endpoint = '';
    let params = { page: page };

    switch(type) {
        case 'trending': endpoint = '/trending'; break;
        case 'for-you': endpoint = '/for-you'; break;
        case 'latest': endpoint = '/latest'; break;
        case 'dubbed': endpoint = '/dubbed'; params.classify = 'terpopuler'; break;
        case 'vip': endpoint = '/vip'; break;
        default: endpoint = '/latest';
    }

    const data = await fetchData(endpoint, params);
    
    // Normalisasi data VIP agar sama dengan yang lain
    if (type === 'vip') {
        let vipList = [];
        if (data && data.columnVoList) {
            data.columnVoList.forEach(col => { 
                if (col.bookList) vipList = [...vipList, ...col.bookList]; 
            });
        }
        return res.json(vipList);
    }

    // Pastikan return Array
    const result = Array.isArray(data) ? data : (data.records || []);
    res.json(result);
});

// --- 3. DETAIL & EPISODES ---
app.get('/api/detail', async (req, res) => {
    const { bookId } = req.query;
    const result = await fetchData('/detail', { bookId });
    res.json(result);
});

app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    const result = await fetchData('/episodes', { bookId });
    
    if (Array.isArray(result)) {
        const formatted = result.map(ep => {
            let videoUrl = "";
            if (ep.cdnList && ep.cdnList.length > 0) {
                // Prioritas: Ambil yang Default, jika tidak ada ambil index 0
                const paths = ep.cdnList[0].videoPathList;
                const defaultVid = paths.find(p => p.isDefault === 1) || paths[0];
                videoUrl = defaultVid ? defaultVid.videoPath : "";
            }
            return {
                id: ep.chapterId,
                index: ep.chapterIndex,
                title: ep.chapterName,
                videoUrl: videoUrl
            };
        });
        return res.json(formatted);
    }
    res.json([]);
});

// --- 4. SEARCH & RANDOM ---
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
