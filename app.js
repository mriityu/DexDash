// App
// --- Autocomplete Logic ---
function handleInput(value) {
    const suggestionsBox = document.getElementById('suggestions');
    if (!value) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const lowerVal = value.toLowerCase();
    const filtered = TOKEN_DATA.filter(t =>
        t.name.toLowerCase().includes(lowerVal) ||
        t.symbol.toLowerCase().includes(lowerVal) ||
        t.address.toLowerCase().includes(lowerVal)
    ).slice(0, 5); // Limit to 5 results

    if (filtered.length > 0) {
        suggestionsBox.innerHTML = filtered.map(t => `
                    <div class="suggestion-item" onclick="selectSuggestion('${t.address}')">
                        <div>
                            <span class="font-bold text-white">${t.symbol}</span>
                            <span class="text-gray-400 text-xs ml-2">${t.name}</span>
                        </div>
                        <i class="fa-solid fa-arrow-right text-gray-500 text-xs"></i>
                    </div>
                `).join('');
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function selectSuggestion(address) {
    const input = document.getElementById('tokenInput');
    input.value = address;
    closeSuggestions();
    fetchTokenData();
}

function closeSuggestions() {
    // Slight delay to allow click event to register before hiding
    setTimeout(() => {
        document.getElementById('suggestions').style.display = 'none';
    }, 200);
}

function clearSearch() {
    const input = document.getElementById('tokenInput');
    input.value = '';
    input.focus();
    closeSuggestions();
}

// --- Main App Logic ---

async function fetchTokenData() {
    const input = document.getElementById('tokenInput');
    const query = input.value.trim();
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const welcomeState = document.getElementById('welcomeState');
    const errorState = document.getElementById('errorState');
    const dashboard = document.getElementById('dashboard');

    if (!query) return;

    // UI Loading State
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    errorState.classList.add('hidden');
    closeSuggestions(); // Ensure dropdown is closed

    try {
        // Fetch data from DexScreener
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
        const data = await response.json();

        if (!data.pairs || data.pairs.length === 0) {
            throw new Error("No pairs found for this token.");
        }

        // Sort by liquidity to get the best pair
        const pair = data.pairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];

        updateUI(pair);

        welcomeState.classList.add('hidden');
        dashboard.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        welcomeState.classList.add('hidden');
        dashboard.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('errorMsg').innerText = "Token pair not found. Check the address and try again.";
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

function updateUI(pair) {
    // Header Info
    document.getElementById('tokenName').innerText = pair.baseToken.name;
    document.getElementById('tokenSymbol').innerText = pair.baseToken.symbol;

    // Image Logic
    const imgUrl = pair.info && pair.info.imageUrl ? pair.info.imageUrl : 'https://cdn-icons-png.flaticon.com/512/12114/12114233.png';
    document.getElementById('tokenImage').src = imgUrl;

    // Price Formatting
    const price = parseFloat(pair.priceUsd);
    document.getElementById('tokenPrice').innerText = price < 0.01 ? `$${price.toFixed(8)}` : `$${price.toFixed(2)}`;

    // 24h Change
    const change = pair.priceChange.h24;
    const changeEl = document.getElementById('priceChange');
    changeEl.innerText = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className = `text-sm font-medium mb-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`;

    // Liquidity & Volume
    document.getElementById('tokenLiquidity').innerText = formatCurrency(pair.liquidity.usd);
    document.getElementById('tokenFdv').innerText = formatCurrency(pair.fdv);
    document.getElementById('tokenVolume').innerText = formatCurrency(pair.volume.h24);
    document.getElementById('txCount').innerText = (pair.txns.h24.buys + pair.txns.h24.sells).toLocaleString();

    // Pair Info Sidebar
    document.getElementById('pairDex').innerText = pair.dexId.toUpperCase();
    document.getElementById('pairChain').innerText = pair.chainId;
    document.getElementById('pairAddress').innerText = pair.pairAddress;
    document.getElementById('baseToken').innerText = pair.baseToken.symbol;
    document.getElementById('quoteToken').innerText = pair.quoteToken.symbol;
    document.getElementById('dexLink').href = pair.url;

    // Price Changes List
    setColorAndText('change5m', pair.priceChange.m5);
    setColorAndText('change1h', pair.priceChange.h1);
    setColorAndText('change6h', pair.priceChange.h6);
    setColorAndText('change24h', pair.priceChange.h24);

    // Update Chart Iframe
    const chartUrl = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&theme=dark&info=0`;
    document.getElementById('chartFrame').src = chartUrl;
}

function setColorAndText(elementId, value) {
    const el = document.getElementById(elementId);
    if (value === undefined || value === null) {
        el.innerText = "-";
        el.className = "font-mono font-bold text-gray-500";
        return;
    }
    el.innerText = `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    el.className = `font-mono font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`;
}

function formatCurrency(num) {
    if (!num) return "$0";
    if (num >= 1000000000) return "$" + (num / 1000000000).toFixed(2) + "B";
    if (num >= 1000000) return "$" + (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return "$" + (num / 1000).toFixed(2) + "K";
    return "$" + num.toFixed(2);
}

function handleKeyPress(event) {
    if (event.key === 'Enter') fetchTokenData();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard!");
}

// Close suggestions when clicking outside (handled by body onclick)
// Prevent closing when clicking inside the input or suggestions box
document.getElementById('tokenInput').addEventListener('click', (e) => e.stopPropagation());
