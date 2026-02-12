// ==========================================
// BACKEND VERCEL - FIX MENTOK 21 EPISODE
// ==========================================
const REFERRAL_CODE = "ALBEDO_VIP_2026"; 
const BASE_URL = "https://dramabox.botraiki.biz/api";

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// --- HELPER FETCH ---
const fetchData = async (endpoint, params = {}) => {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://dramabox.com/',
            'Origin': 'https://dramabox.com/'
        };

        const response = await axios.get(`${BASE_URL}${endpoint}`, { 
            params,
            headers,
            timeout: 10000 
        });
        return response.data;
    } catch (error) {
        return null; // Return null jika error biar loop bisa handle
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

// 3. EPISODES (INI BAGIAN FIX LOOPING-NYA)
app.get('/api/episodes', async (req, res) => {
    const { bookId } = req.query;
    if (!bookId) return res.json([]);

    let allEpisodes = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 15; // Batasi max 15 halaman (sekitar 300-400 episode) biar server ga timeout

    // Kita lakukan Loop request halaman demi halaman
    while (hasMore && page <= MAX_PAGES) {
        // Minta data per halaman (misal per request dapet 20-30 episode)
        const data = await fetchData('/episodes', { bookId, page, size: 30 });
        
        if (Array.isArray(data) && data.length > 0) {
            // Cek apakah data ini sudah ada sebelumnya (untuk mencegah infinite loop kalau API error balikin page 1 terus)
            const firstId = data[0].chapterId;
            const alreadyExists = allEpisodes.some(ep => ep.chapterId === firstId);

            if (alreadyExists) {
                hasMore = false; // Stop, data mulai berulang
            } else {
                allEpisodes = [...allEpisodes, ...data];
                page++; // Lanjut ke halaman berikutnya
            }
        } else {
            hasMore = false; // Data habis/kosong
        }
    }

    // Format Data Akhir
    const formatted = allEpisodes.map(ep => {
        let videoUrl = "";
        
        // Parsing cdnList -> videoPathList
        if (ep.cdnList && ep.cdnList.length > 0) {
            const paths = ep.cdnList[0].videoPathList;
            if (paths && paths.length > 0) {
                // Prioritas: 720p > Default > Index 0
                const vid = paths.find(p => p.quality === 720) || 
                          paths.find(p => p.isDefault === 1) || 
                          paths[0];
                videoUrl = vid ? vid.videoPath : "";
            }
        }
        
        return {
            index: ep.chapterIndex,
            title: ep.chapterName,
            videoUrl: videoUrl
        };
    });

    // Pastikan urut dari episode 1, 2, 3...
    formatted.sort((a, b) => a.index - b.index);

    res.json(formatted);
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
    // Detail biasanya error kalau pakai header, jadi kita bypass helper
    try {
        const response = await axios.get(`${BASE_URL}/detail`, { params: { bookId } }); // Tanpa header
        const result = response.data;
        res.json(result.data ? result.data : result);
    } catch (e) {
        res.json({});
    }
});

module.exports = app;
