/* * =========================================
 * App
 * =========================================
 */

let currentPairs = [];
let activePair = null;

// --- Initialization & Refresh Logic ---
window.addEventListener('load', () => {
    // Check for URL parameter ?pair=0x...
    const urlParams = new URLSearchParams(window.location.search);
    const pairAddress = urlParams.get('pair');

    if (pairAddress) {
        // If param exists, load that specific pair immediately
        document.getElementById('tokenInput').value = pairAddress;
        fetchTokenData(pairAddress);
    }
});

function resetApp() {
    // Clear URL params and reload to base state (Like clicking the logo originally)
    window.location.href = window.location.pathname;
}

// --- Search & API Logic ---

async function fetchTokenData(directAddress = null) {
    const input = document.getElementById('tokenInput');
    const query = directAddress || input.value.trim();
    
    if (!query) return;

    // UI States
    toggleLoader(true);
    closeSuggestions();
    document.getElementById('errorState').classList.add('hidden');

    try {
        let apiUrl = "";
        // Detect if input is a direct address (simple heuristic)
        const isAddress = query.length > 25 && !query.includes(" ");
        
        if (isAddress) {
            apiUrl = `https://api.dexscreener.com/latest/dex/search?q=${query}`;
        } else {
            apiUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data.pairs || data.pairs.length === 0) {
            throw new Error("No pairs found.");
        }

        currentPairs = data.pairs;

        // Liquidity Filter: Avoid dust unless it's a direct address match
        let validPairs = currentPairs;
        if (!isAddress) {
            validPairs = currentPairs.filter(p => p.liquidity && p.liquidity.usd >= 100);
        }

        // Sorting: Highest Liquidity First
        validPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

        if (validPairs.length === 0) throw new Error("No liquid pairs found.");

        if (validPairs.length === 1 || isAddress) {
            loadPair(validPairs[0]);
        } else {
            showSelectionModal(validPairs);
        }

    } catch (err) {
        console.error(err);
        document.getElementById('welcomeState').classList.add('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('errorState').classList.remove('hidden');
        document.getElementById('errorMsg').innerText = err.message || "Error fetching data";
    } finally {
        toggleLoader(false);
    }
}

// --- Core Rendering ---

function loadPair(pair) {
    closeModal();
    activePair = pair;

    // Update URL for refresh capability
    const newUrl = `${window.location.pathname}?pair=${pair.pairAddress}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Populate Header
    document.getElementById('tokenName').innerText = pair.baseToken.name;
    document.getElementById('tokenSymbol').innerText = pair.baseToken.symbol;
    document.getElementById('tokenImage').src = pair.info?.imageUrl || 'https://cdn-icons-png.flaticon.com/512/12114/12114233.png';
    
    // Key Metrics
    const priceChange = pair.priceChange.h24;
    document.getElementById('tokenPrice').innerText = Utils.formatPrice(pair.priceUsd);
    
    const changeEl = document.getElementById('priceChange');
    changeEl.innerText = `${priceChange > 0 ? '+' : ''}${priceChange}%`;
    changeEl.className = `text-sm font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`;

    document.getElementById('tokenLiquidity').innerText = Utils.formatCurrency(pair.liquidity?.usd);
    document.getElementById('tokenVolume').innerText = Utils.formatCurrency(pair.volume.h24);
    document.getElementById('txCount').innerText = (pair.txns.h24.buys + pair.txns.h24.sells).toLocaleString();
    document.getElementById('buysCount').innerText = pair.txns.h24.buys;
    document.getElementById('sellsCount').innerText = pair.txns.h24.sells;

    // Detailed Data Table
    document.getElementById('valFdv').innerText = Utils.formatCurrency(pair.fdv);
    document.getElementById('valMcap').innerText = Utils.formatCurrency(pair.marketCap);
    document.getElementById('valAge').innerText = Utils.formatAge(pair.pairCreatedAt);
    
    // Timeframes
    updateChangeColor('chg1m', pair.priceChange.m1);
    updateChangeColor('chg5m', pair.priceChange.m5);
    updateChangeColor('chg15m', pair.priceChange.m15);
    updateChangeColor('chg1h', pair.priceChange.h1);
    updateChangeColor('chg6h', pair.priceChange.h6);
    updateChangeColor('chg24h', pair.priceChange.h24);

    document.getElementById('valDex').innerText = pair.dexId;
    document.getElementById('valChain').innerText = pair.chainId;
    document.getElementById('valAddress').innerText = pair.pairAddress;
    document.getElementById('dexLink').href = pair.url;

    // Chart
    const chartUrl = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`;
    document.getElementById('chartFrame').src = chartUrl;

    // Show Dashboard
    document.getElementById('welcomeState').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
}

// --- Helpers ---

function updateChangeColor(id, val) {
    const el = document.getElementById(id);
    if (val === undefined || val === null) {
        el.innerText = '-';
        el.className = 'font-mono text-gray-500';
    } else {
        el.innerText = `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
        el.className = `font-mono font-bold ${val >= 0 ? 'text-green-400' : 'text-red-400'}`;
    }
}

function exportData(type) {
    if (!activePair) return;
    if (type === 'json') Exporter.downloadJSON(activePair);
    if (type === 'csv') Exporter.downloadCSV(activePair);
}

function copyAddress() {
    if(activePair) {
        navigator.clipboard.writeText(activePair.pairAddress);
        alert("Pair address copied!");
    }
}

function toggleLoader(isLoading) {
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    if (isLoading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

// --- Modal & Autocomplete Logic (Preserved) ---

function showSelectionModal(pairs) {
    const modal = document.getElementById('tokenModal');
    const list = document.getElementById('tokenList');
    
    list.innerHTML = pairs.map((p, index) => `
        <div class="bg-gray-700/50 hover:bg-gray-700 p-3 rounded-lg cursor-pointer flex items-center justify-between border border-gray-600 transition-colors"
             onclick="selectFromModal(${index})">
            <div class="flex items-center gap-3">
                <div class="bg-gray-800 p-2 rounded w-10 h-10 flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
                    ${p.dexId.substring(0,2)}
                </div>
                <div>
                    <div class="font-bold text-white">${p.baseToken.symbol} / ${p.quoteToken.symbol}</div>
                    <div class="text-xs text-gray-400">${p.dexId} on ${p.chainId}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-sm font-mono text-green-400">${Utils.formatCurrency(p.liquidity?.usd)} Liq</div>
                <div class="text-xs text-gray-500">${Utils.formatPrice(p.priceUsd)}</div>
            </div>
        </div>
    `).join('');
    
    window.modalPairs = pairs;
    modal.classList.remove('hidden');
}

function selectFromModal(index) {
    loadPair(window.modalPairs[index]);
}

function closeModal() {
    document.getElementById('tokenModal').classList.add('hidden');
}

function handleInput(val) {
    const box = document.getElementById('suggestions');
    if (!val) { box.style.display = 'none'; return; }
    box.style.display = 'none';
}

function handleKeyPress(e) {
    if (e.key === 'Enter') fetchTokenData();
}

function clearSearch() {
    document.getElementById('tokenInput').value = '';
    closeSuggestions();
}

function closeSuggestions() {
    document.getElementById('suggestions').style.display = 'none';
}