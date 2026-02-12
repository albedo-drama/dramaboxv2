// ==========================================
// BACKEND VERCEL - ALBEDO TV (FIXED)
// ==========================================
const REFERRAL_CODE = "ALBEDO_VIP_2026"; 
const BASE_URL = "https://dramabox.botraiki.biz/api";

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- Helper Fetch dengan Headers Anti-Blokir ---
const fetchData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { 
            params,
            headers: {
                // Header ini PENTING agar API memberikan data detail/sinopsis
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://dramabox.com/'
            },
            timeout: 10000 // Timeout 10 detik
        });
        return response.data;
    } catch (error) {
        console.error(`[ERROR] ${endpoint}:`, error.message);
        return null;
    }
};

// --- 1. HOME DASHBOARD ---
app.get('/api/home', async (req, res) => {
    // Panggil semua endpoint secara paralel
    const [trending, forYou, dubbed, latest, vip] = await Promise.all([
        fetchData('/trending'),
        fetchData('/for-you'),
        fetchData('/dubbed', { classify: 'terpopuler', page: 1 }),
        fetchData('/latest', { page: 1 }),
        fetchData('/vip')
    ]);

    // Parsing struktur VIP
    let vipList = [];
    if (vip && vip.columnVoList) {
        vip.columnVoList.forEach(col => { 
            if (col.bookList) vipList = [...vipList, ...col.bookList]; 
        });
    }

    res.json({
        referral: REFERRAL_CODE,
        sections: [
            { id: 'trending', title: "Sedang Trending 🔥", type: 'trending', data: trending || [] },
            { id: 'foryou', title: "Rekomendasi Untukmu ❤️", type: 'for-you', data: forYou || [] },
            { id: 'vip', title: "Eksklusif VIP 👑", type: 'vip', data: vipList.slice(0, 8) },
            { id: 'dubbed', title: "Dubbing Indonesia 🇮🇩", type: 'dubbed', data: dubbed || [] },
            { id: 'latest', title: "Rilis Terbaru 🆕", type: 'latest', data: latest || [] }
        ]
    });
});

// --- 2. LIST PER KATEGORI ---
app.get('/api/list', async (req, res) => {
    const { type, page = 1 } = req.query;
    let endpoint = '/latest';
    let params = { page };

    if (type === 'trending') endpoint = '/trending';
    else if (type === 'for-you') endpoint = '/for-you';
    else if (type === 'dubbed') { endpoint = '/dubbed'; params.classify = 'terpopuler'; }
    else if (type === 'vip') endpoint = '/vip';

    const data = await fetchData(endpoint, params);
    
    // Normalisasi VIP
    if (type === 'vip') {
        let vipList = [];
        if (data && data.columnVoList) {
            data.columnVoList.forEach(col => { 
                if (col.bookList) vipList = [...vipList, ...col.bookList]; 
            });
        }
        return res.json(vipList);
    }

    // Pastikan return array
    const result = (Array.isArray(data)) ? data : (data?.records || []);
    res.json(result);
});

// --- 3. DETAIL (FIXED) ---
app.get('/api/detail', async (req, res) => {
    const { bookId } = req.query;
    if (!bookId || bookId === 'undefined') return res.status(400).json({ error: "Invalid ID" });

    // API Dramabox detail butuh parameter bookId
    const result = await fetchData('/detail', { bookId });
    
    // Jika API return null atau error
    if (!result) return res.status(500).json({ error: "Gagal mengambil data dari server pusat" });
    
    res.json(result);
});

// --- 4. EPISODES ---
app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    const result = await fetchData('/episodes', { bookId });
    
    if (Array.isArray(result)) {
        const formatted = result.map(ep => {
            let videoUrl = "";
            if (ep.cdnList && ep.cdnList.length > 0) {
                // Ambil video kualitas terbaik atau default
                const paths = ep.cdnList[0].videoPathList;
                const vid = paths.find(p => p.isDefault === 1) || paths[0];
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

// --- 5. SEARCH & SEARCH POPULAR ---
app.get('/api/search', async (req, res) => {
    const { query } = req.query;
    const result = await fetchData('/search', { query });
    res.json(result || []);
});

app.get('/api/search/popular', async (req, res) => {
    const result = await fetchData('/popular-searches');
    res.json(result || []);
});

// --- 6. RANDOM ---
app.get('/api/random', async (req, res) => {
    const result = await fetchData('/random');
    res.json(result || []);
});

module.exports = app;
